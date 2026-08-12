import dotenv from 'dotenv';

dotenv.config();

export interface SendOTPEmailOptions {
  recipientEmail: string;
  recipientName?: string;
  otpCode: string;
}

export const sendOTPEmail = async ({
  recipientEmail,
  recipientName,
  otpCode,
}: SendOTPEmailOptions): Promise<{ success: boolean; message?: string }> => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'nandeeshmn12@gmail.com';
  const senderName = process.env.BREVO_SENDER_NAME || 'AptiGuard';
  const templateId = process.env.BREVO_FORGOT_PASSWORD_TEMPLATE_ID;

  if (!apiKey) {
    console.error('[BrevoService] BREVO_API_KEY is missing in environment variables.');
    return { success: false, message: 'Brevo API key is not configured.' };
  }

  const name = recipientName || recipientEmail.split('@')[0];
  const currentYear = new Date().getFullYear();

  let payload: any = {
    sender: {
      name: senderName,
      email: senderEmail,
    },
    to: [
      {
        email: recipientEmail,
        name: name,
      },
    ],
  };

  if (templateId && !isNaN(Number(templateId))) {
    payload.templateId = parseInt(templateId, 10);
    payload.params = {
      name,
      otp: otpCode,
      expiryMinutes: 5,
      year: currentYear,
    };
  } else {
    payload.subject = 'Reset Your AptiGuard Password';
    payload.htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 30px 15px; }
          .card { max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; padding: 40px 36px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
          .header { text-align: center; padding-bottom: 24px; border-bottom: 1px solid #f1f5f9; margin-bottom: 32px; }
          .logo-title { color: #031b4e; font-size: 26px; font-weight: 800; margin: 0; letter-spacing: -0.5px; }
          .logo-subtitle { color: #64748b; font-size: 13px; font-weight: 500; margin-top: 4px; margin-bottom: 0; }
          .title { color: #0f172a; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 20px; letter-spacing: -0.3px; }
          .text { color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
          .otp-card { background-color: #f8fafc; border: 1.5px solid #1e293b; border-radius: 10px; padding: 28px 20px; text-align: center; margin: 28px 0; }
          .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #0f172a; margin-bottom: 10px; }
          .otp-expiry { color: #dc2626; font-size: 13px; font-weight: 600; margin: 0; }
          .security-text { color: #475569; font-size: 13px; line-height: 1.5; margin-bottom: 24px; }
          .security-box { background-color: #f0f7ff; border-left: 4px solid #0952cc; border-radius: 6px; padding: 16px 18px; margin: 28px 0; }
          .security-box-text { color: #334155; font-size: 13px; line-height: 1.5; margin: 0; }
          .security-box-bold { font-weight: 700; color: #0f172a; }
          .footer { margin-top: 40px; text-align: center; color: #94a3b8; font-size: 12px; line-height: 1.6; }
          .footer p { margin: 2px 0; }
          .footer-brand { color: #64748b; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="card">
          <!-- Header -->
          <div class="header">
            <h1 class="logo-title">AptiGuard</h1>
            <p class="logo-subtitle">Secure College Assessment Platform</p>
          </div>

          <!-- Main Content -->
          <h2 class="title">Reset Your AptiGuard Password</h2>
          
          <p class="text">Hello <strong>${name}</strong>,</p>
          <p class="text">We received a request to reset the password for your AptiGuard account. Use the One-Time Password below to continue with your password reset:</p>

          <!-- OTP Box -->
          <div class="otp-card">
            <div class="otp-code">${otpCode}</div>
            <p class="otp-expiry">This OTP is valid for 5 minutes.</p>
          </div>

          <p class="security-text">For your security, do not share this OTP with anyone.</p>

          <!-- Security Callout Notice -->
          <div class="security-box">
            <p class="security-box-text">
              <span class="security-box-bold">Security Notice:</span> If you did not request a password reset, you can safely ignore this email. Your account remains secure and no action is required.
            </p>
          </div>

          <!-- Footer -->
          <div class="footer">
            <p>Regards,</p>
            <p class="footer-brand">AptiGuard Team</p>
            <p>Secure College Assessment Platform</p>
            <p style="margin-top: 12px;">&copy; ${currentYear} AptiGuard. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data: any = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = data?.message || data?.code || `HTTP ${response.status}`;
      console.error('[BrevoService] Failed to send OTP email via Brevo:', errorMsg);

      if (
        response.status === 400 &&
        (errorMsg.toLowerCase().includes('sender') || errorMsg.toLowerCase().includes('unverified'))
      ) {
        return { success: false, message: 'Brevo sender email is not verified.' };
      }

      return { success: false, message: errorMsg };
    }

    console.log(`[BrevoService] OTP email sent successfully to ${recipientEmail}. Message ID: ${data?.messageId || 'N/A'}`);
    return { success: true };
  } catch (error: any) {
    console.error('[BrevoService] Network error while calling Brevo API:', error?.message || error);
    return { success: false, message: 'Network error communicating with Brevo email service.' };
  }
};

export interface SendTestUpdateEmailOptions {
  recipientEmail: string;
  recipientName: string;
  testTitle: string;
  changedDetails: string[];
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  duration?: number;
}

export const sendTestUpdateEmail = async ({
  recipientEmail,
  recipientName,
  testTitle,
  changedDetails,
  startDate,
  startTime,
  endDate,
  endTime,
  duration,
}: SendTestUpdateEmailOptions): Promise<{ success: boolean; message?: string }> => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'nandeeshmn12@gmail.com';
  const senderName = process.env.BREVO_SENDER_NAME || 'AptiGuard';

  if (!apiKey) {
    console.error('[Test Update Email] Failed: BREVO_API_KEY is missing in environment variables.');
    return { success: false, message: 'Brevo API key is not configured.' };
  }

  const name = recipientName || recipientEmail.split('@')[0];
  const currentYear = new Date().getFullYear();

  const changesListHtml = changedDetails && changedDetails.length > 0
    ? changedDetails.map(d => `<li style="margin-bottom: 6px; color: #0f172a; font-weight: 600;">${d}</li>`).join('')
    : '<li style="margin-bottom: 6px; color: #0f172a; font-weight: 600;">Assessment configuration and schedule parameters updated</li>';

  const scheduleText = startDate && startTime && endDate && endTime
    ? `${startDate} at ${startTime} — ${endDate} at ${endTime}`
    : startDate && startTime
      ? `Starts at ${startDate} ${startTime}`
      : 'Immediate / Active Schedule';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 30px 15px; }
        .card { max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; padding: 40px 36px; box-shadow: 0 4px 16px rgba(0,0,0,0.04); }
        .header { text-align: center; padding-bottom: 24px; border-bottom: 1px solid #f1f5f9; margin-bottom: 32px; }
        .logo-title { color: #031b4e; font-size: 28px; font-weight: 800; margin: 0; letter-spacing: -0.5px; }
        .logo-subtitle { color: #64748b; font-size: 13px; font-weight: 500; margin-top: 4px; margin-bottom: 0; }
        .title { color: #0f172a; font-size: 20px; font-weight: 800; margin-top: 0; margin-bottom: 16px; letter-spacing: -0.3px; }
        .text { color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
        .details-card { background-color: #f0f7ff; border-left: 4px solid #0952cc; border-radius: 8px; padding: 20px 24px; margin: 24px 0; }
        .details-title { color: #031b4e; font-size: 15px; font-weight: 800; margin-top: 0; margin-bottom: 12px; }
        .details-list { margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.6; }
        .meta-grid { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; margin: 24px 0; display: table; width: 100%; box-sizing: border-box; }
        .meta-row { display: table-row; }
        .meta-cell { display: table-cell; padding: 6px 12px; font-size: 13px; color: #475569; }
        .meta-label { font-weight: 700; color: #0f172a; width: 140px; }
        .footer { margin-top: 40px; text-align: center; color: #94a3b8; font-size: 12px; line-height: 1.6; }
        .footer p { margin: 2px 0; }
        .footer-brand { color: #64748b; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="card">
        <!-- Header -->
        <div class="header">
          <h1 class="logo-title">AptiGuard</h1>
          <p class="logo-subtitle">Secure College Assessment Platform</p>
        </div>

        <!-- Main Content -->
        <h2 class="title">Test Updated: ${testTitle}</h2>
        
        <p class="text">Hello <strong>${name}</strong>,</p>
        <p class="text">The details of your upcoming AptiGuard assessment have been updated. Please review the updated test information below:</p>

        <!-- Updated Details Callout -->
        <div class="details-card">
          <h3 class="details-title">Updated Details</h3>
          <ul class="details-list">
            ${changesListHtml}
          </ul>
        </div>

        <!-- Meta Schedule Grid -->
        <div class="meta-grid">
          <div class="meta-row">
            <div class="meta-cell meta-label">Assessment:</div>
            <div class="meta-cell" style="font-weight: 700; color: #031b4e;">${testTitle}</div>
          </div>
          <div class="meta-row">
            <div class="meta-cell meta-label">Schedule Window:</div>
            <div class="meta-cell">${scheduleText}</div>
          </div>
          ${duration ? `
          <div class="meta-row">
            <div class="meta-cell meta-label">Duration:</div>
            <div class="meta-cell">${duration} Mins</div>
          </div>
          ` : ''}
        </div>

        <p class="text">Please log in to your AptiGuard Student Portal to view the latest assessment details.</p>

        <!-- Footer -->
        <div class="footer">
          <p>Regards,</p>
          <p class="footer-brand">AptiGuard Team</p>
          <p>Secure College Assessment Platform</p>
          <p style="margin-top: 12px;">&copy; ${currentYear} AptiGuard. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const payload = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: recipientEmail, name }],
    subject: `AptiGuard – Test Updated: ${testTitle}`,
    htmlContent,
  };

  console.log(`[Test Update Email] Preparing email for: ${recipientEmail}`);
  console.log(`[Test Update Email] Sending Brevo email...`);

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data: any = await response.json().catch(() => ({}));
    console.log(`[Test Update Email] Brevo response: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorMsg = data?.message || data?.code || `HTTP ${response.status}`;
      console.error(`[Test Update Email] Failed to send email to ${recipientEmail}: ${errorMsg}`);
      return { success: false, message: errorMsg };
    }

    console.log(`[Test Update Email] Email sent successfully to: ${recipientEmail} (Message ID: ${data?.messageId || 'N/A'})`);
    return { success: true };
  } catch (error: any) {
    const safeError = error?.message || 'Network error communicating with Brevo.';
    console.error(`[Test Update Email] Failed: ${safeError}`);
    return { success: false, message: safeError };
  }
};

export const sendBatchTestUpdateEmails = async (
  recipients: Array<{ email: string; name: string }>,
  testInfo: {
    testTitle: string;
    changedDetails: string[];
    startDate?: string;
    startTime?: string;
    endDate?: string;
    endTime?: string;
    duration?: number;
  }
): Promise<{ sentCount: number; failedCount: number }> => {
  const BATCH_SIZE = 10;
  let sentCount = 0;
  let failedCount = 0;

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((r) =>
        sendTestUpdateEmail({
          recipientEmail: r.email,
          recipientName: r.name,
          testTitle: testInfo.testTitle,
          changedDetails: testInfo.changedDetails,
          startDate: testInfo.startDate,
          startTime: testInfo.startTime,
          endDate: testInfo.endDate,
          endTime: testInfo.endTime,
          duration: testInfo.duration,
        })
      )
    );

    results.forEach((res) => {
      if (res.status === 'fulfilled' && res.value.success) {
        sentCount++;
      } else {
        failedCount++;
      }
    });
  }

  return { sentCount, failedCount };
};
