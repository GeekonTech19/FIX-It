import type { Request } from 'express';
import type { UserRole } from '@prisma/client';

export interface AuthRequest extends Request {
  user?: { id: string; role: UserRole; email: string };
}
