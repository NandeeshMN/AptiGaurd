const { sendBatchTestUpdateEmails } = require('./dist/services/brevoService.js');
const dotenv = require('dotenv');

dotenv.config({ path: './.env' });

async function testMail() {
    const res = await sendBatchTestUpdateEmails([{email: 'nandeeshmn5900@gmail.com', name: 'Nandesh'}], {
        testTitle: 'Debug Final Test',
        changedDetails: ['Debugging'],
        startDate: '2026-08-15',
        startTime: '10:00'
    });
    console.log(res);
}

testMail().catch(console.error);
