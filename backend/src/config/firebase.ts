import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

const projectId = process.env.FIREBASE_PROJECT_ID || 'aptigaurd';

if (admin.apps.length === 0) {
  try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId,
      });
    } else {
      // Local dev: initialize without credentials (relies on open Firestore rules or emulator)
      admin.initializeApp({
        projectId,
      });
    }
  } catch (err) {
    console.error('[firebase-admin] Initialization error:', err);
  }
}

export const adminAuth = admin.apps.length > 0 ? admin.auth() : null;
export const adminDb = admin.apps.length > 0 ? admin.firestore() : null;

