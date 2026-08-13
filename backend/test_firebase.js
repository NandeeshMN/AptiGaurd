const { adminDb } = require('./dist/config/firebase.js');

async function testFirebase() {
    if (!adminDb) {
        console.error("adminDb is not initialized!");
        return;
    }
    const usersSnap = await adminDb.collection('users').get();
    const users = [];
    usersSnap.forEach(doc => {
        users.push(doc.data());
    });
    console.log(`Found ${users.length} users in 'users' collection.`);
    users.forEach(u => console.log(u.email, u.role));
}

testFirebase().catch(console.error);
