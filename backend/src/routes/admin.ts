import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import type { AuthRequest } from '../types.js';
import { UPLOAD_DIR } from '../upload.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('SUPER_ADMIN'));

adminRouter.get('/stats', async (_req, res) => {
  const [providers, verifiedProviders, openRequests, assignedRequests, completedRequests, disputes, reviews, transactions] = await Promise.all([
    prisma.user.count({ where: { role: 'PROVIDER' } }),
    prisma.user.count({ where: { role: 'PROVIDER', kycStatus: 'VERIFIED' } }),
    prisma.serviceRequest.count({ where: { status: 'OPEN' } }),
    prisma.serviceRequest.count({ where: { status: { in: ['ASSIGNED', 'IN_PROGRESS', 'AWAITING_COMPLETION'] } } }),
    prisma.serviceRequest.count({ where: { status: { in: ['COMPLETED', 'RESOLVED'] } } }),
    prisma.dispute.count({ where: { status: 'OPEN' } }),
    prisma.review.count(),
    prisma.transaction.count(),
  ]);
  return res.json({ providers, verifiedProviders, openRequests, assignedRequests, completedRequests, openDisputes: disputes, reviews, transactions });
});

adminRouter.get('/providers', async (_req, res) => {
  const providers = await prisma.user.findMany({ where: { role: 'PROVIDER' }, include: { reviews: true, jobs: true }, orderBy: { createdAt: 'desc' } });
  return res.json(providers.map(p => {
    const avg = p.reviews.length ? p.reviews.reduce((s, r) => s + r.rating, 0) / p.reviews.length : 0;
    return { id: p.id, name: `${p.firstName} ${p.lastName}`, email: p.email, phone: p.phone, kycStatus: p.kycStatus, categories: p.categories, serviceAreas: p.serviceAreas, rating: Number(avg.toFixed(1)), reviewCount: p.reviews.length, completedJobs: p.jobs.filter(j => ['COMPLETED','RESOLVED'].includes(j.status)).length, createdAt: p.createdAt };
  }));
});

adminRouter.get('/providers/:providerId', async (req, res) => {
  const provider = await prisma.user.findUnique({ where: { id: req.params.providerId, role: 'PROVIDER' }, include: { reviews: { orderBy: { createdAt: 'desc' } }, jobs: { include: { request: true }, orderBy: { createdAt: 'desc' } } } });
  if (!provider) return res.status(404).json({ message: 'Provider not found' });
  const requestIds = provider.jobs.map(j => j.requestId);
  const [audits, comments, transactions, disputes] = await Promise.all([
    prisma.auditLog.findMany({ where: { requestId: { in: requestIds } }, orderBy: { createdAt: 'desc' }, take: 250 }),
    prisma.comment.findMany({ where: { requestId: { in: requestIds } }, orderBy: { createdAt: 'desc' }, take: 250 }),
    prisma.transaction.findMany({ where: { requestId: { in: requestIds } }, orderBy: { createdAt: 'desc' }, take: 250 }),
    prisma.dispute.findMany({ where: { providerId: provider.id }, orderBy: { createdAt: 'desc' } }),
  ]);
  const avg = provider.reviews.length ? provider.reviews.reduce((s, r) => s + r.rating, 0) / provider.reviews.length : 0;
  return res.json({
    provider: { id: provider.id, firstName: provider.firstName, lastName: provider.lastName, email: provider.email, phone: provider.phone, bio: provider.bio, qualifications: provider.qualifications, references: provider.references, sop: provider.sop, categories: provider.categories, serviceAreas: provider.serviceAreas, kycStatus: provider.kycStatus, verifiedAt: provider.verifiedAt, kycDocumentPath: provider.kycDocumentPath, rating: Number(avg.toFixed(1)), reviewCount: provider.reviews.length },
    jobs: provider.jobs,
    reviews: provider.reviews,
    audits,
    comments,
    transactions,
    disputes,
  });
});

adminRouter.post('/providers/:providerId/verify', async (req: AuthRequest, res) => {
  const status = String(req.body.status || '').toUpperCase();
  if (!['VERIFIED', 'REJECTED', 'PENDING'].includes(status)) return res.status(400).json({ message: 'Invalid KYC status' });
  const updated = await prisma.user.update({ where: { id: req.params.providerId }, data: { kycStatus: status as any, verifiedAt: status === 'VERIFIED' ? new Date() : null } });
  return res.json({ id: updated.id, kycStatus: updated.kycStatus, verifiedAt: updated.verifiedAt });
});

adminRouter.get('/providers/:providerId/kyc-document', async (req, res) => {
  const provider = await prisma.user.findUnique({ where: { id: req.params.providerId, role: 'PROVIDER' }, select: { kycDocumentPath: true } });
  if (!provider?.kycDocumentPath) return res.status(404).json({ message: 'No KYC document uploaded' });
  const full = path.join(UPLOAD_DIR, provider.kycDocumentPath);
  if (!fs.existsSync(full)) return res.status(404).json({ message: 'KYC file is not available on this server' });
  return res.sendFile(full);
});

adminRouter.get('/requests', async (_req, res) => {
  const requests = await prisma.serviceRequest.findMany({ include: { assignedProvider: true, job: true, review: true, dispute: true }, orderBy: { createdAt: 'desc' }, take: 250 });
  return res.json(requests.map(r => ({
    id: r.id, trackingCode: r.trackingCode, category: r.category, area: r.area, status: r.status, description: r.description,
    clientName: r.clientName, clientEmail: r.clientEmail, clientPhone: r.clientPhone, preferredDate: r.preferredDate,
    provider: r.assignedProvider ? `${r.assignedProvider.firstName} ${r.assignedProvider.lastName}` : null,
    providerId: r.assignedProviderId, jobStatus: r.job?.status ?? null, hasReview: Boolean(r.review), dispute: r.dispute,
    createdAt: r.createdAt,
  })));
});

adminRouter.post('/requests/:requestId/interject', async (req: AuthRequest, res) => {
  const message = String(req.body.message || '').trim();
  if (!message) return res.status(400).json({ message: 'Interjection message is required' });
  const request = await prisma.serviceRequest.findUnique({ where: { id: req.params.requestId } });
  if (!request) return res.status(404).json({ message: 'Request not found' });
  const note = await prisma.adminNote.create({ data: { requestId: request.id, adminId: req.user!.id, message, visibleToClient: true } });
  await prisma.auditLog.create({ data: { requestId: request.id, actorUserId: req.user!.id, actorType: 'ADMIN', event: 'ADMIN_INTERJECTION', note: message, visibleToClient: true } });
  await prisma.comment.create({ data: { requestId: request.id, authorType: 'ADMIN', authorUserId: req.user!.id, text: message } });
  return res.status(201).json(note);
});

adminRouter.post('/requests/:requestId/resolve-dispute', async (req: AuthRequest, res) => {
  const resolution = String(req.body.resolution || '').trim();
  if (!resolution) return res.status(400).json({ message: 'Resolution is required' });
  const request = await prisma.serviceRequest.findUnique({ where: { id: req.params.requestId }, include: { job: true, dispute: true } });
  if (!request?.dispute) return res.status(404).json({ message: 'Dispute not found' });
  await prisma.dispute.update({ where: { requestId: request.id }, data: { status: 'RESOLVED', resolution, resolvedAt: new Date(), resolvedById: req.user!.id } });
  if (request.job) await prisma.job.update({ where: { id: request.job.id }, data: { status: 'RESOLVED', completedAt: request.job.completedAt ?? new Date() } });
  await prisma.serviceRequest.update({ where: { id: request.id }, data: { status: 'RESOLVED' } });
  await prisma.auditLog.create({ data: { requestId: request.id, actorUserId: req.user!.id, actorType: 'ADMIN', event: 'DISPUTE_RESOLVED', note: resolution, visibleToClient: true } });
  return res.json({ message: 'Dispute resolved' });
});

adminRouter.get('/requests/:requestId/receipt/:filename', async (req, res) => {
  const transaction = await prisma.transaction.findFirst({ where: { requestId: req.params.requestId, receiptPath: req.params.filename } });
  if (!transaction) return res.status(404).json({ message: 'Receipt not found' });
  const full = path.join(UPLOAD_DIR, req.params.filename);
  if (!fs.existsSync(full)) return res.status(404).json({ message: 'Receipt file not found on this server' });
  return res.sendFile(full);
});
