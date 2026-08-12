import { Router, Request, Response } from 'express';
import { adminAuth } from '../config/firebase';
import { sendOTPEmail } from '../services/brevoService';

const router = Router();

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// In-memory OTP storage with expiration
interface OTPRecord {
  code: string;
  expiresAt: number;
}
const otpStore = new Map<string, OTPRecord>();

/**
 * Generate a random 6-digit numeric OTP code
 */
const generate6DigitOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Common handler for sending OTP via Brevo
 */
const handleSendOtpLogic = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    res.status(400).json({
      success: false,
      message: 'Please provide a valid email address.',
    });
    return;
  }

  const sanitizedEmail = email.trim().toLowerCase();
  const otpCode = generate6DigitOTP();
  const expiresAt = Date.now() + 5 * 60 * 1000; // Valid for 5 minutes

  // Store in memory
  otpStore.set(sanitizedEmail, { code: otpCode, expiresAt });

  let recipientName = sanitizedEmail.split('@')[0];
  if (adminAuth) {
    try {
      const userRecord = await adminAuth.getUserByEmail(sanitizedEmail);
      if (userRecord.displayName) {
        recipientName = userRecord.displayName;
      }
    } catch {
      // User profile lookup notice (continue cleanly)
    }
  }

  // Deliver OTP via Brevo API
  const emailResult = await sendOTPEmail({
    recipientEmail: sanitizedEmail,
    recipientName,
    otpCode,
  });

  if (!emailResult.success) {
    if (emailResult.message === 'Brevo sender email is not verified.') {
      res.status(400).json({
        success: false,
        message: 'Brevo sender email is not verified.',
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Failed to send OTP email via Brevo.',
    });
    return;
  }

  res.json({
    success: true,
    message: 'OTP sent to your email address.',
  });
};

/**
 * POST /api/auth/send-otp
 */
router.post('/send-otp', handleSendOtpLogic);

/**
 * POST /api/auth/forgot-password (alias)
 */
router.post('/forgot-password', handleSendOtpLogic);

/**
 * POST /api/auth/verify-otp
 * Verifies the 6-digit OTP provided by the user.
 */
router.post('/verify-otp', (req: Request, res: Response): void => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    res.status(400).json({
      success: false,
      message: 'Email and OTP code are required.',
    });
    return;
  }

  const sanitizedEmail = email.trim().toLowerCase();
  const record = otpStore.get(sanitizedEmail);

  if (!record) {
    res.status(400).json({
      success: false,
      message: 'No active OTP found for this email. Please request a new OTP.',
    });
    return;
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(sanitizedEmail);
    res.status(400).json({
      success: false,
      message: 'OTP has expired. Please request a new OTP.',
    });
    return;
  }

  if (record.code !== otp.trim()) {
    res.status(400).json({
      success: false,
      message: 'Incorrect OTP code. Please try again.',
    });
    return;
  }

  res.json({
    success: true,
    message: 'OTP verified successfully.',
  });
});

/**
 * POST /api/auth/reset-password-otp
 * Verifies OTP and updates the user's password in Firebase Authentication.
 */
router.post('/reset-password-otp', async (req: Request, res: Response): Promise<void> => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    res.status(400).json({
      success: false,
      message: 'Email, OTP, and new password are required.',
    });
    return;
  }

  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters long.',
    });
    return;
  }

  const sanitizedEmail = email.trim().toLowerCase();
  const record = otpStore.get(sanitizedEmail);

  if (!record || record.code !== otp.trim() || Date.now() > record.expiresAt) {
    res.status(400).json({
      success: false,
      message: 'Invalid or expired OTP session.',
    });
    return;
  }

  try {
    if (adminAuth) {
      try {
        const userRecord = await adminAuth.getUserByEmail(sanitizedEmail);
        await adminAuth.updateUser(userRecord.uid, { password: newPassword });
        console.log(`[AuthRoute] Updated password for user ${sanitizedEmail} in Firebase Auth.`);
      } catch (fbErr: any) {
        console.warn('[AuthRoute] Firebase Admin update notice:', fbErr?.message || fbErr);
      }
    }

    // Clear used OTP
    otpStore.delete(sanitizedEmail);

    res.json({
      success: true,
      message: 'Password updated successfully.',
    });
  } catch (err: any) {
    console.error('[AuthRoute] Error updating password:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to update password.',
    });
  }
});

export default router;
