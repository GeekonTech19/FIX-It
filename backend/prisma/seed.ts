import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const email = process.env.SUPER_ADMIN_EMAIL ?? 'admin@fixit.local';
const password = process.env.SUPER_ADMIN_PASSWORD ?? 'ChangeMe123!';

const passwordHash = await bcrypt.hash(password, 12);

await prisma.user.upsert({
  where: { email },
  update: {
    role: 'SUPER_ADMIN',
    passwordHash,
    firstName: process.env.SUPER_ADMIN_FIRST_NAME ?? 'FIX',
    lastName: process.env.SUPER_ADMIN_LAST_NAME ?? 'Administrator',
  },
  create: {
    role: 'SUPER_ADMIN',
    firstName: process.env.SUPER_ADMIN_FIRST_NAME ?? 'FIX',
    lastName: process.env.SUPER_ADMIN_LAST_NAME ?? 'Administrator',
    email,
    phone: '0000000000',
    passwordHash,
    qualifications: 'Platform administrator',
    sop: 'Platform governance, provider vetting, dispute oversight.',
    categories: ['GENERAL'],
    serviceAreas: ['ALL'],
    kycStatus: 'VERIFIED',
    verifiedAt: new Date(),
  },
});

console.log(`Seeded super admin: ${email}`);
await prisma.$disconnect();
