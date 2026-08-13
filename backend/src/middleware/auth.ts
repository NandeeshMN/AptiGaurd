import { Request, Response, NextFunction } from 'express';
import { adminAuth, adminDb } from '../config/firebase';

export interface AuthRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    role?: 'admin' | 'student';
  };
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });
    return;
  }

  if (!adminAuth) {
    res.status(503).json({ success: false, message: 'Auth service not available. Firebase Admin not initialized.' });
    return;
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const email = (decodedToken.email || '').toLowerCase().trim();
    let role: 'admin' | 'student' = (email === 'nandeeshmn12@gmail.com' || (decodedToken as any).role === 'admin' || (decodedToken as any).admin === true) ? 'admin' : 'student';

    if (role !== 'admin' && adminDb) {
      try {
        const uSnap = await adminDb.collection('users').doc(decodedToken.uid).get();
        if (uSnap.exists) {
          const uData = uSnap.data() || {};
          if (uData.role === 'admin' || uData.isAdmin === true || (uData.email && uData.email.toLowerCase() === 'nandeeshmn12@gmail.com')) {
            role = 'admin';
          }
        }
      } catch (err) {
        // Fallback silently if user doc query fails
      }
    }

    req.user = {
      uid: decodedToken.uid,
      email,
      role,
    };
    next();
  } catch (error) {
    console.error('Auth verification error:', error);
    res.status(401).json({ success: false, message: 'Unauthorized: Invalid token' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ success: false, message: 'Forbidden: Admin access only' });
    return;
  }
  next();
};
