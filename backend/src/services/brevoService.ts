import dotenv from 'dotenv';

dotenv.config();

export interface SendOTPEmailOptions {
  recipientEmail: string;
  recipientName?: string;
  otpCode: string;
}

const formatDateToDDMMYYYY = (dateVal: any): string => {
  if (!dateVal) return '';
  if (typeof dateVal === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(dateVal)) return dateVal;
  if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
    const [y, m, d] = dateVal.split('-');
    return `${d}/${m}/${y}`;
  }
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return String(dateVal);
  }
};

const formatTimeTo12Hour = (timeStr: any): string => {
  if (!timeStr || typeof timeStr !== 'string') return '';
  if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr;
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  if (isNaN(hours)) return timeStr;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
};

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
      <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
      <html xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>Reset Your AptiGuard Password</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f7fb; font-family: Arial, Helvetica, sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f7fb; width: 100%;">
          <tr>
            <td align="center" style="padding: 30px 15px;">
              <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 520px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; padding: 36px;">
                <tr>
                  <td align="center" style="border-bottom: 1px solid #f1f5f9; padding-bottom: 20px; font-family: Arial, Helvetica, sans-serif;">
                    <div style="font-size: 26px; font-weight: 900; color: #0952cc; margin: 0;">AptiGuard</div>
                    <div style="font-size: 12px; font-weight: 700; color: #64748b; margin-top: 4px;">Secure College Assessment Platform</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 24px; font-family: Arial, Helvetica, sans-serif; color: #0f172a;">
                    <div style="font-size: 20px; font-weight: 700; margin-bottom: 16px;">Reset Your AptiGuard Password</div>
                    <div style="font-size: 14px; color: #334155; line-height: 1.6; margin-bottom: 12px;">Hello <strong>${name}</strong>,</div>
                    <div style="font-size: 14px; color: #334155; line-height: 1.6; margin-bottom: 24px;">We received a request to reset the password for your AptiGuard account. Use the One-Time Password below:</div>
                    <div style="background-color: #f8fafc; border: 1.5px solid #1e293b; border-radius: 10px; padding: 24px; text-align: center; margin-bottom: 24px;">
                      <div style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #0f172a;">${otpCode}</div>
                      <div style="color: #dc2626; font-size: 13px; font-weight: 700; margin-top: 8px;">This OTP is valid for 5 minutes.</div>
                    </div>
                    <div style="font-size: 13px; color: #475569; line-height: 1.5; margin-bottom: 24px;">For your security, do not share this OTP with anyone.</div>
                    <div style="background-color: #f0f7ff; border-left: 4px solid #0952cc; border-radius: 6px; padding: 14px 16px; font-size: 13px; color: #334155; line-height: 1.5;">
                      <strong>Security Notice:</strong> If you did not request a password reset, you can safely ignore this email.
                    </div>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 32px; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #94a3b8; line-height: 1.6;">
                    <div>Regards, <strong>AptiGuard Team</strong></div>
                    <div>&copy; ${currentYear} AptiGuard. All rights reserved.</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
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
    console.log('[OTP] Brevo response received');

    if (!response.ok) {
      const errorMsg = data?.message || data?.code || `HTTP ${response.status}`;
      console.error(`[OTP] Failed to send OTP email to ${recipientEmail}: ${errorMsg}`);
      return { success: false, message: errorMsg };
    }

    console.log(`[OTP] OTP sent successfully to ${recipientEmail}. Message ID: ${data?.messageId || 'N/A'}`);
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
  const dashboardUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173';

  if (!apiKey) {
    console.error(`[Test Updated Email] Recipient: ${recipientEmail} | Status: FAILED (BREVO_API_KEY missing in environment)`);
    return { success: false, message: 'Brevo API key is not configured.' };
  }

  const cleanEmail = (recipientEmail || '').trim().toLowerCase();
  if (!cleanEmail) {
    return { success: false, message: 'Empty recipient email.' };
  }

  let studentName = (recipientName || '').trim();
  if (!studentName || studentName.includes('@')) {
    const prefix = cleanEmail.split('@')[0];
    studentName = prefix.charAt(0).toUpperCase() + prefix.slice(1);
  }

  const testName = testTitle || 'Assessment';
  const currentYear = new Date().getFullYear();

  const changedDetailsHtml = changedDetails && changedDetails.length > 0
    ? changedDetails.map(d => `<li style="margin-bottom: 6px;">${d}</li>`).join('')
    : '<li style="margin-bottom: 6px;">Assessment configuration and schedule have been updated.</li>';

  const sDateFormatted = startDate ? formatDateToDDMMYYYY(startDate) : '';
  const eDateFormatted = endDate ? formatDateToDDMMYYYY(endDate) : sDateFormatted;
  const sTimeFormatted = startTime ? formatTimeTo12Hour(startTime) : '';
  const eTimeFormatted = endTime ? formatTimeTo12Hour(endTime) : '';

  const startDateTime = sDateFormatted && sTimeFormatted
    ? `${sDateFormatted} at ${sTimeFormatted}`
    : sDateFormatted || 'Immediate Access';

  const endDateTime = eDateFormatted && eTimeFormatted
    ? `${eDateFormatted} at ${eTimeFormatted}`
    : eDateFormatted || 'Flexible Availability';

  // 100% EMAIL-CLIENT COMPATIBLE TABLE-BASED HTML LAYOUT
  const htmlContent = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>AptiGuard | Assessment Updated — ${testName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f7fb; font-family: Arial, Helvetica, sans-serif;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f7fb; width: 100%;">
  <tr>
    <td align="center" style="padding: 32px 15px;">

      <!-- 600px Max Container Table -->
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        
        <!-- HEADER -->
        <tr>
          <td align="center" style="padding: 32px 32px 24px 32px; background-color: #ffffff; border-bottom: 1px solid #f1f5f9; font-family: Arial, Helvetica, sans-serif;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="font-family: Arial, Helvetica, sans-serif;">
                  <div style="font-size: 26px; font-weight: 900; color: #0952cc; letter-spacing: -0.5px; margin: 0;">APTiGUARD</div>
                  <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 3px;">Secure Online Assessment Platform</div>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-top: 14px;">
                  <span style="background-color: #e0e7ff; color: #3730a3; font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: 800; padding: 5px 14px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block;">Assessment Update</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CONTENT BODY -->
        <tr>
          <td style="padding: 32px; font-family: Arial, Helvetica, sans-serif; color: #1f2937;">
            
            <!-- GREETING -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-family: Arial, Helvetica, sans-serif; font-size: 16px; font-weight: 700; color: #0f172a; padding-bottom: 12px;">
                  Hello ${studentName},
                </td>
              </tr>
              <tr>
                <td style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #334155; line-height: 1.6; padding-bottom: 8px;">
                  The assessment assigned to you has been updated by the administrator.
                </td>
              </tr>
              <tr>
                <td style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #334155; line-height: 1.6; padding-bottom: 24px;">
                  Please review the revised assessment details below.
                </td>
              </tr>
            </table>

            <!-- ASSESSMENT & UPDATED INFORMATION CARD -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #0952cc; border-radius: 8px; margin-bottom: 24px;">
              <tr>
                <td style="padding: 20px 24px; font-family: Arial, Helvetica, sans-serif;">
                  <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Assessment</div>
                  <div style="font-size: 18px; font-weight: 800; color: #031b4e; margin-bottom: 16px;">${testName}</div>
                  
                  <div style="font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Updated Information</div>
                  <ul style="margin: 0; padding-left: 20px; color: #334155; font-size: 13.5px; line-height: 1.6; font-weight: 600;">
                    ${changedDetailsHtml}
                  </ul>
                </td>
              </tr>
            </table>

            <!-- SCHEDULE TABLE -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 24px; overflow: hidden;">
              <tr>
                <td style="background-color: #f1f5f9; padding: 12px 20px; font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0;">
                  Schedule
                </td>
              </tr>
              <tr>
                <td style="padding: 20px; font-family: Arial, Helvetica, sans-serif;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="50%" valign="top" style="padding-right: 10px; font-family: Arial, Helvetica, sans-serif;">
                        <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Start</div>
                        <div style="font-size: 13.5px; font-weight: 700; color: #0f172a;">${startDateTime}</div>
                      </td>
                      <td width="50%" valign="top" style="padding-left: 10px; font-family: Arial, Helvetica, sans-serif;">
                        <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">End</div>
                        <div style="font-size: 13.5px; font-weight: 700; color: #0f172a;">${endDateTime}</div>
                      </td>
                    </tr>
                  </table>

                  <!-- Important Schedule Callout Notice -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 16px; background-color: #eff6ff; border-left: 4px solid #2563eb; border-radius: 4px;">
                    <tr>
                      <td style="padding: 12px 16px; font-family: Arial, Helvetica, sans-serif; font-size: 12.5px; color: #1e3a8a; line-height: 1.5;">
                        <strong>IMPORTANT:</strong> The assessment is available only within the scheduled assessment window. If you begin the assessment after the scheduled start time, your available time will be limited by the scheduled end time.
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- ACTION BUTTON TABLE -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 28px;">
              <tr>
                <td align="center" style="padding: 8px 0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center" bgcolor="#0952cc" style="border-radius: 8px;">
                        <a href="${dashboardUrl}" target="_blank" style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: 800; color: #ffffff; text-decoration: none; display: inline-block; padding: 14px 32px; border-radius: 8px; border: 1px solid #0952cc; background-color: #0952cc;">View Assessment Dashboard</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- MESSAGE -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-family: Arial, Helvetica, sans-serif; font-size: 13.5px; color: #334155; line-height: 1.6; padding-bottom: 4px;">
                  Please log in to your AptiGuard dashboard to view the latest assessment information.
                </td>
              </tr>
              <tr>
                <td style="font-family: Arial, Helvetica, sans-serif; font-size: 13.5px; color: #334155; line-height: 1.6;">
                  Make sure you review the updated schedule before starting the assessment.
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td align="center" style="padding: 28px 32px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; font-family: Arial, Helvetica, sans-serif;">
            <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 2px;">Regards,</div>
            <div style="font-size: 14px; font-weight: 800; color: #0952cc; margin-bottom: 8px;">AptiGuard Team</div>
            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Secure &bull; Fair &bull; Proctored</div>
            <div style="font-size: 11.5px; color: #94a3b8;">&copy; ${currentYear} AptiGuard. All rights reserved.</div>
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>

</body>
</html>`;

  // Validate htmlContent content & length before sending
  if (!htmlContent || htmlContent.trim().length < 200 || htmlContent.trim() === 'Test' || htmlContent.includes('<h1>Test</h1>')) {
    console.error('[Test Updated Email] CRITICAL ERROR: htmlContent is missing or is an invalid placeholder!');
    throw new Error('Test Updated email HTML content is missing or invalid placeholder.');
  }

  // Log safe debugging metadata
  console.log(`[Test Updated Email] HTML generated: YES | HTML length: ${htmlContent.length} | Recipient: ${cleanEmail} | Content ready: YES`);

  const payload = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: cleanEmail, name: studentName }],
    subject: `AptiGuard | Assessment Updated — ${testName}`,
    htmlContent,
  };

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
      console.error(`[Test Updated Email] Recipient: ${cleanEmail} | Status: FAILED (${errorMsg})`);
      return { success: false, message: errorMsg };
    }

    console.log(`[Test Updated Email] Recipient: ${cleanEmail} | Status: SUCCESS (${response.status} Created) | Message ID: ${data?.messageId || 'N/A'}`);
    return { success: true };
  } catch (error: any) {
    const safeError = error?.message || 'Network error communicating with Brevo.';
    console.error(`[Test Updated Email] Recipient: ${cleanEmail} | Status: FAILED (${safeError})`);
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
