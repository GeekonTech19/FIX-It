import { Router } from 'express';
import { prisma } from '../db.js';
import { hashToken, makeClientToken, makeTrackingCode, ratingEmoji, safeUser } from '../utils.js';
import { getEligibleProviderRanking } from '../ranking.js';
import { upload } from '../upload.js';

export const publicRouter = Router();

publicRouter.get('/providers', async (_req, res) => {
  const providers = await prisma.user.findMany({
    where: { role: 'PROVIDER', kycStatus: 'VERIFIED' },
    include: { reviews: true, jobs: true },
    orderBy: { verifiedAt: 'desc' },
  });

  const data = providers.map(p => {
    const ratings = p.reviews.map(r => r.rating);
    const average = ratings.length ? ratings.reduce((s, n) => s + n, 0) / ratings.length : 0;
    return {
      ...safeUser(p, Number(average.toFixed(1)), p.reviews.length),
      completedJobs: p.jobs.filter(j => ['COMPLETED', 'RESOLVED'].includes(j.status)).length,
      reviews: p.reviews.sort((a,b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 6).map(r => ({ id: r.id, rating: r.rating, emoji: r.emoji, comment: r.comment, createdAt: r.createdAt })),
    };
  });

  return res.json(data);
});

publicRouter.post('/requests', upload.single('receipt'), async (req, res) => {
  try {
    const { clientName, clientEmail, clientPhone, category, description, area, addressNote, preferredDate, paymentReference, paymentAmount, paymentNotes } = req.body;
    if (!clientName || !clientEmail || !clientPhone || !category || !description || !area) {
      return res.status(400).json({ message: 'Client contact, service category, description and area are required' });
    }
    if ((req.file && !paymentReference) || (!req.file && paymentReference)) {
      return res.status(400).json({ message: 'Payment reference and receipt must be provided together' });
    }
    const clientToken = makeClientToken();
    const request = await prisma.serviceRequest.create({
      data: {
        trackingCode: makeTrackingCode(),
        clientTokenHash: hashToken(clientToken),
        clientName: String(clientName).trim(),
        clientEmail: String(clientEmail).trim(),
        clientPhone: String(clientPhone).trim(),
        category: String(category).trim().toUpperCase(),
        description: String(description).trim(),
        area: String(area).trim(),
        addressNote: addressNote ? String(addressNote).trim() : null,
        preferredDate: preferredDate ? new Date(preferredDate) : null,
        audits: { create: { actorType: 'CLIENT', event: 'REQUEST_CREATED', note: 'Client created a new service request.', visibleToClient: true } },
      },
    });

    if (req.file && paymentReference) {
      await prisma.transaction.create({
        data: {
          requestId: request.id,
          createdByType: 'CLIENT',
          type: 'PAYMENT_RECEIPT',
          amount: paymentAmount ? Number(paymentAmount) : null,
          currency: 'NGN',
          reference: String(paymentReference).trim(),
          notes: paymentNotes ? String(paymentNotes).trim() : null,
          receiptPath: req.file.filename,
        },
      });
      await prisma.auditLog.create({
        data: { requestId: request.id, actorType: 'CLIENT', event: 'PAYMENT_RECEIPT_UPLOADED', note: 'Payment reference and receipt were recorded.', visibleToClient: true },
      });
    }

    return res.status(201).json({
      message: 'Service request submitted',
      trackingCode: request.trackingCode,
      clientToken,
      trackingUrl: `/track/${request.trackingCode}`,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Unable to create service request' });
  }
});

publicRouter.get('/requests/:trackingCode', async (req, res) => {
  const request = await prisma.serviceRequest.findUnique({
    where: { trackingCode: req.params.trackingCode },
    include: {
      assignedProvider: true,
      job: true,
      audits: { where: { visibleToClient: true }, orderBy: { createdAt: 'asc' } },
      comments: { orderBy: { createdAt: 'asc' } },
      review: true,
      dispute: true,
    },
  });
  if (!request) return res.status(404).json({ message: 'Request not found' });

  const provider = request.assignedProvider ? {
    id: request.assignedProvider.id,
    name: `${request.assignedProvider.firstName} ${request.assignedProvider.lastName}`,
    phone: request.assignedProvider.phone,
    email: request.assignedProvider.email,
    qualifications: request.assignedProvider.qualifications,
    sop: request.assignedProvider.sop,
  } : null;

  return res.json({
    trackingCode: request.trackingCode,
    category: request.category,
    description: request.description,
    area: request.area,
    preferredDate: request.preferredDate,
    status: request.status,
    provider,
    audits: request.audits,
    comments: request.comments,
    review: request.review,
    dispute: request.dispute,
  });
});

async function findRequestWithClientToken(trackingCode: string, clientToken: string) {
  const request = await prisma.serviceRequest.findUnique({ where: { trackingCode } });
  if (!request || hashToken(clientToken) !== request.clientTokenHash) return null;
  return request;
}

publicRouter.post('/requests/:trackingCode/comments', async (req, res) => {
  const clientToken = req.header('x-client-token') || req.body.clientToken;
  const request = clientToken ? await findRequestWithClientToken(req.params.trackingCode, clientToken) : null;
  if (!request) return res.status(401).json({ message: 'Client access key required' });
  const { text, isComplaint } = req.body;
  if (!text?.trim()) return res.status(400).json({ message: 'Comment is required' });
  const comment = await prisma.comment.create({ data: { requestId: request.id, authorType: 'CLIENT', text: String(text).trim(), isComplaint: Boolean(isComplaint) } });
  if (isComplaint) {
    await prisma.auditLog.create({ data: { requestId: request.id, actorType: 'CLIENT', event: 'CLIENT_COMPLAINT', note: String(text).trim(), visibleToClient: true } });
  }
  return res.status(201).json(comment);
});

publicRouter.post('/requests/:trackingCode/review', async (req, res) => {
  const clientToken = req.header('x-client-token') || req.body.clientToken;
  const request = clientToken ? await findRequestWithClientToken(req.params.trackingCode, clientToken) : null;
  if (!request) return res.status(401).json({ message: 'Client access key required' });
  if (!['COMPLETED', 'RESOLVED'].includes(request.status)) return res.status(400).json({ message: 'A review can only be left after completion' });
  if (!request.assignedProviderId) return res.status(400).json({ message: 'No provider is assigned to this request' });
  const rating = Math.min(5, Math.max(1, Number(req.body.rating)));
  const comment = String(req.body.comment || '').trim();
  if (!comment) return res.status(400).json({ message: 'Review comment is required' });
  const review = await prisma.review.create({ data: { requestId: request.id, providerId: request.assignedProviderId, rating, emoji: ratingEmoji(rating), comment } });
  await prisma.auditLog.create({ data: { requestId: request.id, actorType: 'CLIENT', event: 'CLIENT_REVIEW', note: `${rating}/5 ${ratingEmoji(rating)} — ${comment}`, visibleToClient: true } });
  return res.status(201).json(review);
});

publicRouter.post('/requests/:trackingCode/dispute', async (req, res) => {
  const clientToken = req.header('x-client-token') || req.body.clientToken;
  const request = clientToken ? await findRequestWithClientToken(req.params.trackingCode, clientToken) : null;
  if (!request) return res.status(401).json({ message: 'Client access key required' });
  if (!request.assignedProviderId) return res.status(400).json({ message: 'No provider is assigned to this request' });
  const reason = String(req.body.reason || '').trim();
  if (!reason) return res.status(400).json({ message: 'Dispute reason is required' });
  if (request.dispute) return res.status(409).json({ message: 'A dispute is already open for this request' });
  const dispute = await prisma.dispute.create({ data: { requestId: request.id, providerId: request.assignedProviderId, raisedByType: 'CLIENT', reason } });
  await prisma.serviceRequest.update({ where: { id: request.id }, data: { status: 'DISPUTED' } });
  if (request.job) await prisma.job.update({ where: { id: request.job.id }, data: { status: 'DISPUTED' } });
  await prisma.auditLog.create({ data: { requestId: request.id, actorType: 'CLIENT', event: 'DISPUTE_OPENED', note: reason, visibleToClient: true } });
  return res.status(201).json(dispute);
});

