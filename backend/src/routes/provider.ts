import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import type { AuthRequest } from '../types.js';
import { getEligibleProviderRanking } from '../ranking.js';
import { safeUser } from '../utils.js';
import { upload } from '../upload.js';

export const providerRouter = Router();
providerRouter.use(requireAuth, requireRole('PROVIDER'));

async function providerRating(providerId: string) {
  const reviews = await prisma.review.findMany({ where: { providerId } });
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  return { average: Number(avg.toFixed(1)), count: reviews.length };
}

async function getOwnJob(req: AuthRequest, jobId: string) {
  return prisma.job.findFirst({ where: { id: jobId, providerId: req.user!.id }, include: { request: true, provider: true } });
}

providerRouter.get('/me', async (req: AuthRequest, res) => {
  const provider = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!provider) return res.status(404).json({ message: 'Provider not found' });
  const rating = await providerRating(provider.id);
  return res.json({ ...safeUser(provider, rating.average, rating.count) });
});

providerRouter.put('/me', upload.single('kycDocument'), async (req: AuthRequest, res) => {
  const provider = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!provider) return res.status(404).json({ message: 'Provider not found' });
  const nextKycStatus = provider.kycStatus === 'VERIFIED' ? 'PENDING' : provider.kycStatus;
  const updated = await prisma.user.update({
    where: { id: provider.id },
    data: {
      bio: req.body.bio ? String(req.body.bio).trim() : null,
      qualifications: String(req.body.qualifications ?? provider.qualifications).trim(),
      references: req.body.references ? String(req.body.references).trim() : null,
      sop: String(req.body.sop ?? provider.sop).trim(),
      categories: String(req.body.categories ?? provider.categories.join(',')).split(',').map(v => v.trim()).filter(Boolean),
      serviceAreas: String(req.body.serviceAreas ?? provider.serviceAreas.join(',')).split(',').map(v => v.trim()).filter(Boolean),
      ...(req.file ? { kycDocumentPath: req.file.filename } : {}),
      ...(req.file ? { kycStatus: nextKycStatus } : {}),
    },
  });
  return res.json({ message: 'Profile updated', kycStatus: updated.kycStatus });
});

providerRouter.get('/dashboard', async (req: AuthRequest, res) => {
  const provider = await prisma.user.findUnique({ where: { id: req.user!.id }, include: { reviews: true, jobs: true } });
  if (!provider) return res.status(404).json({ message: 'Provider not found' });
  const rankingReady = provider.kycStatus === 'VERIFIED';
  const openCalls = rankingReady ? await prisma.serviceRequest.findMany({ where: { status: 'OPEN' }, orderBy: { createdAt: 'desc' }, take: 50 }) : [];
  const rating = provider.reviews.length ? provider.reviews.reduce((s, r) => s + r.rating, 0) / provider.reviews.length : 0;
  const disputes = await prisma.dispute.count({ where: { providerId: provider.id, status: 'OPEN' } });
  const resolutions = await prisma.dispute.count({ where: { providerId: provider.id, status: 'RESOLVED' } });
  return res.json({
    provider: { firstName: provider.firstName, lastName: provider.lastName, kycStatus: provider.kycStatus },
    stats: {
      openCalls: openCalls.length,
      pendingCalls: provider.jobs.filter(j => ['ASSIGNED', 'IN_PROGRESS', 'AWAITING_COMPLETION', 'DISPUTED'].includes(j.status)).length,
      closedCalls: provider.jobs.filter(j => ['COMPLETED', 'RESOLVED', 'CANCELLED'].includes(j.status)).length,
      reviews: provider.reviews.length,
      disputes,
      resolutions,
      averageRating: Number(rating.toFixed(1)),
    },
    openCalls,
  });
});

providerRouter.get('/jobs/open', async (req: AuthRequest, res) => {
  const provider = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!provider || provider.kycStatus !== 'VERIFIED') return res.status(403).json({ message: 'KYC verification is required before job access' });
  const requests = await prisma.serviceRequest.findMany({ where: { status: 'OPEN' }, orderBy: { createdAt: 'desc' }, take: 100 });
  const result = [];
  for (const request of requests) {
    const ranking = await getEligibleProviderRanking(request);
    const leader = ranking[0];
    result.push({
      id: request.id,
      trackingCode: request.trackingCode,
      category: request.category,
      description: request.description,
      area: request.area,
      preferredDate: request.preferredDate,
      createdAt: request.createdAt,
      canPull: Boolean(leader && leader.provider.id === provider.id),
      rank: leader ? ranking.findIndex(r => r.provider.id === provider.id) + 1 : null,
      candidateCount: ranking.length,
      reason: leader?.provider.id === provider.id ? 'Top eligible provider by current review ranking.' : 'Another higher-ranked verified provider is currently eligible.',
    });
  }
  return res.json(result);
});

providerRouter.post('/jobs/:requestId/pull', async (req: AuthRequest, res) => {
  const provider = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!provider || provider.kycStatus !== 'VERIFIED') return res.status(403).json({ message: 'KYC verification is required' });
  const request = await prisma.serviceRequest.findUnique({ where: { id: req.params.requestId } });
  if (!request) return res.status(404).json({ message: 'Call not found' });
  if (request.status !== 'OPEN') return res.status(409).json({ message: 'This call is no longer open' });
  const ranking = await getEligibleProviderRanking(request);
  const leader = ranking[0];
  if (!leader || leader.provider.id !== provider.id) return res.status(403).json({ message: 'This call is assigned by the review ranking. You are not the current eligible leader.' });

  try {
    const job = await prisma.$transaction(async tx => {
      const fresh = await tx.serviceRequest.findUnique({ where: { id: request.id } });
      if (!fresh || fresh.status !== 'OPEN') throw new Error('CALL_TAKEN');
      const created = await tx.job.create({ data: { requestId: request.id, providerId: provider.id, status: 'ASSIGNED' } });
      await tx.serviceRequest.update({ where: { id: request.id }, data: { status: 'ASSIGNED', assignedProviderId: provider.id } });
      await tx.auditLog.create({ data: { requestId: request.id, actorUserId: provider.id, actorType: 'PROVIDER', event: 'JOB_ASSIGNED', note: `Assigned to ${provider.firstName} ${provider.lastName} using the current review ranking.`, visibleToClient: true } });
      return created;
    });
    return res.status(201).json(job);
  } catch (error) {
    if (error instanceof Error && error.message === 'CALL_TAKEN') return res.status(409).json({ message: 'Another provider claimed this call first' });
    console.error(error);
    return res.status(500).json({ message: 'Unable to assign job' });
  }
});

providerRouter.get('/jobs', async (req: AuthRequest, res) => {
  const jobs = await prisma.job.findMany({ where: { providerId: req.user!.id }, include: { request: true }, orderBy: { createdAt: 'desc' } });
  return res.json(jobs);
});

providerRouter.get('/jobs/:jobId', async (req: AuthRequest, res) => {
  const job = await getOwnJob(req, req.params.jobId);
  if (!job) return res.status(404).json({ message: 'Job not found' });
  const audits = await prisma.auditLog.findMany({ where: { requestId: job.requestId }, orderBy: { createdAt: 'asc' } });
  const comments = await prisma.comment.findMany({ where: { requestId: job.requestId }, orderBy: { createdAt: 'asc' } });
  const transactions = await prisma.transaction.findMany({ where: { requestId: job.requestId }, orderBy: { createdAt: 'desc' } });
  const dispute = await prisma.dispute.findUnique({ where: { requestId: job.requestId } });
  return res.json({ job, audits, comments, transactions, dispute });
});

providerRouter.post('/jobs/:jobId/status', async (req: AuthRequest, res) => {
  const job = await getOwnJob(req, req.params.jobId);
  if (!job) return res.status(404).json({ message: 'Job not found' });
  const next = String(req.body.status || '').toUpperCase();
  const allowed: Record<string, string[]> = {
    ASSIGNED: ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['AWAITING_COMPLETION', 'CANCELLED'],
    AWAITING_COMPLETION: ['COMPLETED'],
    DISPUTED: [],
  };
  if (!allowed[job.status]?.includes(next)) return res.status(400).json({ message: `Cannot change status from ${job.status} to ${next}` });
  const updated = await prisma.$transaction(async tx => {
    const j = await tx.job.update({ where: { id: job.id }, data: {
      status: next as any,
      startedAt: next === 'IN_PROGRESS' ? new Date() : job.startedAt,
      completionAt: next === 'AWAITING_COMPLETION' ? new Date() : job.completionAt,
      completedAt: next === 'COMPLETED' ? new Date() : job.completedAt,
    } });
    await tx.serviceRequest.update({ where: { id: job.requestId }, data: { status: next as any } });
    await tx.auditLog.create({ data: { requestId: job.requestId, actorUserId: req.user!.id, actorType: 'PROVIDER', event: `STATUS_${next}`, note: String(req.body.note || `Provider moved job to ${next}.`), visibleToClient: true } });
    return j;
  });
  return res.json(updated);
});

providerRouter.post('/jobs/:jobId/audit', async (req: AuthRequest, res) => {
  const job = await getOwnJob(req, req.params.jobId);
  if (!job) return res.status(404).json({ message: 'Job not found' });
  const note = String(req.body.note || '').trim();
  if (!note) return res.status(400).json({ message: 'Progress note is required' });
  const audit = await prisma.auditLog.create({ data: { requestId: job.requestId, actorUserId: req.user!.id, actorType: 'PROVIDER', event: 'PROGRESS_UPDATE', note, visibleToClient: true } });
  return res.status(201).json(audit);
});

providerRouter.post('/jobs/:jobId/comments', async (req: AuthRequest, res) => {
  const job = await getOwnJob(req, req.params.jobId);
  if (!job) return res.status(404).json({ message: 'Job not found' });
  const text = String(req.body.text || '').trim();
  if (!text) return res.status(400).json({ message: 'Comment is required' });
  return res.status(201).json(await prisma.comment.create({ data: { requestId: job.requestId, authorType: 'PROVIDER', authorUserId: req.user!.id, text } }));
});

providerRouter.post('/jobs/:jobId/transaction', upload.single('receipt'), async (req: AuthRequest, res) => {
  const job = await getOwnJob(req, req.params.jobId);
  if (!job) return res.status(404).json({ message: 'Job not found' });
  const reference = String(req.body.reference || '').trim();
  if (!reference) return res.status(400).json({ message: 'Transaction reference is required' });
  const transaction = await prisma.transaction.create({
    data: {
      requestId: job.requestId,
      createdByType: 'PROVIDER',
      createdByUserId: req.user!.id,
      type: String(req.body.type || 'OTHER') as any,
      amount: req.body.amount ? Number(req.body.amount) : null,
      currency: 'NGN',
      reference,
      notes: req.body.notes ? String(req.body.notes).trim() : null,
      receiptPath: req.file?.filename ?? null,
    },
  });
  await prisma.auditLog.create({ data: { requestId: job.requestId, actorUserId: req.user!.id, actorType: 'PROVIDER', event: 'TRANSACTION_RECORDED', note: `Transaction ${reference} recorded on the platform.`, visibleToClient: true } });
  return res.status(201).json(transaction);
});

providerRouter.post('/jobs/:jobId/dispute-response', async (req: AuthRequest, res) => {
  const job = await getOwnJob(req, req.params.jobId);
  if (!job) return res.status(404).json({ message: 'Job not found' });
  const response = String(req.body.response || '').trim();
  if (!response) return res.status(400).json({ message: 'Response is required' });
  const dispute = await prisma.dispute.update({ where: { requestId: job.requestId }, data: { response } });
  await prisma.comment.create({ data: { requestId: job.requestId, authorType: 'PROVIDER', authorUserId: req.user!.id, text: response } });
  await prisma.auditLog.create({ data: { requestId: job.requestId, actorUserId: req.user!.id, actorType: 'PROVIDER', event: 'DISPUTE_RESPONSE', note: response, visibleToClient: true } });
  return res.json(dispute);
});
