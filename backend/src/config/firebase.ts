import * as admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables before any initialization
dotenv.config();

// Guard against duplicate Firebase Admin app instantiation
if (admin.apps.length === 0) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      // ── PRODUCTION / RENDER ─────────────────────────────────────────────────
      // Read service account from environment variable (never from disk).
      // Render stores the full service-account JSON as a single env var string.
      let serviceAccount: admin.ServiceAccount;

      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) as admin.ServiceAccount;
      } catch {
        throw new Error(
          '[firebase-admin] FIREBASE_SERVICE_ACCOUNT env variable contains invalid JSON. ' +
          'Ensure it is the raw JSON content of your Firebase service-account key file.'
        );
      }

      // Restore actual newline characters in the PEM private key.
      // Cloud platforms often store multi-line strings with literal "\\n" sequences
      // rather than real newlines, which causes OpenSSL's PEM decoder to fail.
      if ((serviceAccount as any).private_key) {
        (serviceAccount as any).private_key = (serviceAccount as any).private_key.replace(/\\n/g, '\n');
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });

      console.log('[firebase-admin] Firebase Admin initialized successfully using FIREBASE_SERVICE_ACCOUNT environment variable.');

    } else {
      // ── LOCAL DEVELOPMENT ────────────────────────────────────────────────────
      // Fall back to the local service-account JSON file.
      // This file must exist locally but is excluded from Git via .gitignore.
      const candidatePaths: string[] = [
        // Honour an explicit override env var for advanced local setups
        process.env.FIREBASE_SERVICE_ACCOUNT_PATH
          ? path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
          : '',
        path.resolve(process.cwd(), 'config/firebase.json'),
        path.resolve(__dirname, '../../config/firebase.json'),
        path.resolve(__dirname, '../config/firebase.json'),
        path.resolve(__dirname, 'firebase.json'),
      ].filter(Boolean);

      const serviceAccountPath = candidatePaths.find((p) => fs.existsSync(p)) ?? null;

      if (serviceAccountPath) {
        let serviceAccount: admin.ServiceAccount;

        try {
          const raw = fs.readFileSync(serviceAccountPath, 'utf8');
          serviceAccount = JSON.parse(raw) as admin.ServiceAccount;
        } catch (e: any) {
          throw new Error(
            `[firebase-admin] Failed to read or parse service account file at ` +
            `"${serviceAccountPath}": ${e?.message ?? String(e)}`
          );
        }

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });

        console.log(
          `[firebase-admin] Firebase Admin initialized successfully using service account file: ` +
          `${path.relative(process.cwd(), serviceAccountPath)}`
        );

      } else if (
        process.env.GOOGLE_APPLICATION_CREDENTIALS &&
        fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)
      ) {
        // Application Default Credentials fallback (e.g. gcloud auth)
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
        });

        console.log('[firebase-admin] Firebase Admin initialized via Application Default Credentials.');

      } else {
        // No credentials available – app boots in degraded mode.
        // Admin-only routes will fail at request time, not at startup.
        console.error(
          '[firebase-admin] WARNING: No Firebase credentials found. ' +
          'Set FIREBASE_SERVICE_ACCOUNT (production) or provide config/firebase.json (local). ' +
          'Firebase Admin features will be unavailable.'
        );

        admin.initializeApp();
      }
    }
  } catch (err: any) {
    console.error('[firebase-admin] Initialization error:', err?.message ?? err);
  }
}

export const adminAuth  = admin.apps.length > 0 ? admin.auth()      : null;
export const adminDb    = admin.apps.length > 0 ? admin.firestore() : null;
export default admin;
