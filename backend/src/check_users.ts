import { adminDb } from './config/firebase';

async function run() {
  if (!adminDb) return;
  const users = await adminDb.collection('users').get();
  users.forEach(doc => console.log(doc.id, '=>', doc.data()));
}

run().then(() => process.exit(0)).catch(console.error);
