import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { authRouter } from './routes/auth.js';
import { publicRouter } from './routes/public.js';
import { providerRouter } from './routes/provider.js';
import { adminRouter } from './routes/admin.js';

const app = express();
const port = Number(process.env.PORT ?? 5000);
const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173';

app.use(helmet());
app.use(cors({ origin: clientUrl, credentials: false }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

app.use(rateLimit({ windowMs: 60_000, max: 180, standardHeaders: true, legacyHeaders: false }));

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'FIX it backend', version: '0.1.0' }));
app.use('/api/auth', authRouter);
app.use('/api/public', publicRouter);
app.use('/api/provider', providerRouter);
app.use('/api/admin', adminRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  if (err?.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ message: 'File too large. Maximum size is 10 MB.' });
  return res.status(500).json({ message: 'Unexpected server error' });
});

app.listen(port, () => console.log(`FIX it backend running on http://localhost:${port}`));
