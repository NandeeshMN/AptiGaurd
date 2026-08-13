import * as admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// 1. Ensure dotenv is loaded BEFORE Firebase Admin initialization
dotenv.config();

const projectId = process.env.FIREBASE_PROJECT_ID || 'aptigaurd';

// 2. Centralized Firebase Admin Initialization using Service Account JSON
if (admin.apps.length === 0) {
  try {
    // Resolve service-account file path safely using Node's path & fs modules
    const candidatePaths = [
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH ? path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH) : null,
      path.resolve(process.cwd(), 'config/firebase.json'),
      path.resolve(__dirname, '../../config/firebase.json'),
      path.resolve(__dirname, 'firebase.json'),
      path.resolve(__dirname, '../config/firebase.json'),
    ].filter(Boolean) as string[];

    let serviceAccount: any = null;
    let serviceAccountPath: string | null = null;

    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      } catch (e: any) {
        console.error('[firebase-admin] Failed to parse FIREBASE_SERVICE_ACCOUNT env variable:', e?.message || e);
      }
    }

    if (!serviceAccount) {
      for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
          serviceAccountPath = p;
          break;
        }
      }

      if (serviceAccountPath) {
        try {
          const serviceAccountRaw = fs.readFileSync(serviceAccountPath, 'utf8');
          serviceAccount = JSON.parse(serviceAccountRaw);
        } catch (e: any) {
          console.error(`[firebase-admin] Failed to read or parse service account file at ${serviceAccountPath}:`, e?.message || e);
        }
      }
    }

    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || projectId,
      });

      if (serviceAccountPath) {
        console.log(`[firebase-admin] Firebase Admin initialized successfully using service account file: ${path.relative(process.cwd(), serviceAccountPath)}`);
      } else {
        console.log(`[firebase-admin] Firebase Admin initialized successfully using FIREBASE_SERVICE_ACCOUNT environment variable.`);
      }
      console.log(`[firebase-admin] Firestore initialized successfully for project: ${serviceAccount.project_id || projectId}`);
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId,
      });
      console.log('[firebase-admin] Firebase Admin initialized successfully via Application Default Credentials.');
    } else {
      console.error('[firebase-admin] ERROR: Firebase service account could not be loaded from backend/config/firebase.json');
      admin.initializeApp({
        projectId,
      });
    }
  } catch (err: any) {
    console.error('[firebase-admin] Initialization error:', err?.message || err);
  }
}

export const adminAuth = admin.apps.length > 0 ? admin.auth() : null;
export const adminDb = admin.apps.length > 0 ? admin.firestore() : null;
export default admin;
