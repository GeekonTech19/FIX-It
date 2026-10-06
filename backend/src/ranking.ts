import { prisma } from './db.js';

const ACTIVE_JOB_STATUSES = ['ASSIGNED', 'IN_PROGRESS', 'AWAITING_COMPLETION', 'DISPUTED'];

export async function getEligibleProviderRanking(request: { category: string; area: string }) {
  const providers = await prisma.user.findMany({
    where: {
      role: 'PROVIDER',
      kycStatus: 'VERIFIED',
      OR: [
        { categories: { has: request.category } },
        { categories: { has: 'GENERAL' } },
      ],
    },
    include: { reviews: true, jobs: true },
  });

  const area = request.area.toLowerCase();
  return providers
    .filter(provider => provider.serviceAreas.includes('ALL') || provider.serviceAreas.some(a => a.toLowerCase().includes(area) || area.includes(a.toLowerCase())))
    .map(provider => {
      const ratings = provider.reviews.map(r => r.rating);
      const average = ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : 0;
      const completed = provider.jobs.filter(j => ['COMPLETED', 'RESOLVED'].includes(j.status)).length;
      const activeJobs = provider.jobs.filter(j => ACTIVE_JOB_STATUSES.includes(j.status)).length;
      return { provider, average, reviewCount: ratings.length, completed, activeJobs };
    })
    .filter(row => row.activeJobs === 0)
    .sort((a, b) => b.average - a.average || b.reviewCount - a.reviewCount || b.completed - a.completed);
}
