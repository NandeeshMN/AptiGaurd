import express, { Request, Response } from 'express';
import cors from 'cors';
import testRouter from './routes/tests';
import authRouter from './routes/auth';

const app = express();

// Verify required Brevo configuration on startup
const brevoKey = process.env.BREVO_API_KEY;
const brevoSenderEmail = process.env.BREVO_SENDER_EMAIL;
const brevoSenderName = process.env.BREVO_SENDER_NAME;

if (!brevoKey || !brevoSenderEmail || !brevoSenderName) {
  console.warn('\n⚠️  [WARN] Brevo Configuration Notice:');
  if (!brevoKey) console.warn('   - BREVO_API_KEY is not set');
  if (!brevoSenderEmail) console.warn('   - BREVO_SENDER_EMAIL is not set');
  if (!brevoSenderName) console.warn('   - BREVO_SENDER_NAME is not set');
  console.warn('   Transactional emails via Brevo will not function until these variables are configured in backend/.env.\n');
} else {
  console.log('✅ Brevo configuration validated successfully.');
}

const allowedOrigins = [
  'http://localhost:5173',
  'https://apti-gaurd.vercel.app',
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL
].filter(Boolean) as string[];

// Middlewares
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());

// Routes
app.use('/api/tests', testRouter);
app.use('/api/auth', authRouter);

// Basic health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'AptiGuard backend is running',
  });
});

export default app;
