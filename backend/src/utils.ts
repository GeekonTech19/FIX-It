import crypto from 'node:crypto';

export function hashToken(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function makeClientToken() {
  return crypto.randomBytes(24).toString('hex');
}

export function makeTrackingCode() {
  return `FIX-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

export function normalizeList(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map(v => v.trim()).filter(Boolean);
  return String(value ?? '').split(',').map(v => v.trim()).filter(Boolean);
}

export function ratingEmoji(rating: number) {
  if (rating >= 5) return '🙌';
  if (rating >= 4) return '🙂';
  if (rating >= 3) return '😐';
  if (rating >= 2) return '😕';
  return '😞';
}

export function safeUser(user: any, rating = 0, reviewCount = 0) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    email: user.email,
    bio: user.bio,
    qualifications: user.qualifications,
    references: user.references,
    sop: user.sop,
    categories: user.categories,
    serviceAreas: user.serviceAreas,
    kycStatus: user.kycStatus,
    rating,
    reviewCount,
    verifiedAt: user.verifiedAt,
  };
}
