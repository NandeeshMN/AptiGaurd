import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../config/firebase';

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
    // Determine role (admin shortcut vs normal checks)
    const email = decodedToken.email || '';
    const role = email.toLowerCase() === 'nandeeshmn12@gmail.com' ? 'admin' : 'student';

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
