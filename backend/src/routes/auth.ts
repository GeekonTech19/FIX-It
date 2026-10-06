import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db.js';
import { checkCredentials, signUser } from '../auth.js';
import { normalizeList } from '../utils.js';
import { upload } from '../upload.js';

export const authRouter = Router();

authRouter.post('/provider/register', upload.single('kycDocument'), async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password, bio, qualifications, references, sop } = req.body;
    if (!firstName || !lastName || !email || !phone || !password || !qualifications || !sop) {
      return res.status(400).json({ message: 'Required provider fields are missing' });
    }
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });
    const exists = await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } });
    if (exists) return res.status(409).json({ message: 'An account with this email already exists' });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        role: 'PROVIDER',
        firstName: String(firstName).trim(),
        lastName: String(lastName).trim(),
        email: String(email).toLowerCase().trim(),
        phone: String(phone).trim(),
        passwordHash,
        bio: bio ? String(bio).trim() : null,
        qualifications: String(qualifications).trim(),
        references: references ? String(references).trim() : null,
        sop: String(sop).trim(),
        categories: normalizeList(req.body.categories),
        serviceAreas: normalizeList(req.body.serviceAreas),
        kycDocumentPath: req.file?.filename ?? null,
        kycStatus: 'PENDING',
      },
    });
    return res.status(201).json({ message: 'Provider account created. KYC review is required before job access.', userId: user.id });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Unable to register provider' });
  }
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });
  const user = await checkCredentials(String(email), String(password));
  if (!user) return res.status(401).json({ message: 'Invalid email or password' });
  const token = signUser(user);
  return res.json({
    token,
    user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role, kycStatus: user.kycStatus },
  });
});
