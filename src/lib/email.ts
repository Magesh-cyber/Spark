/**
 * SPARK Email Provider & Delivery Service
 * Supports standard SMTP (e.g. Resend, SendGrid, Amazon SES, or custom SMTP)
 * with robust local development and fallback logging.
 */

import nodemailer from "nodemailer";

export interface SendOtpParams {
  email: string;
  fullName: string;
  otp: string; // 4-digit code e.g. "4829"
}

export interface SendInvitationParams {
  email: string;
  workspaceName: string;
  inviterName: string;
  role: string;
  acceptUrl: string;
}

/**
 * Returns a configured Nodemailer transporter if SMTP environment variables are present.
 */
function getTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host) {
    return null;
  }

  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });
}

/**
 * Dispatches a 4-digit registration OTP to the specified email address.
 */
export async function sendSignupOtpEmail(
  params: SendOtpParams
): Promise<{ success: boolean; devOtp?: string }> {
  const { email, fullName, otp } = params;
  const transporter = getTransporter();

  // Branded HTML email body
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your SPARK Verification Code</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #0b0d13; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; margin: 40px auto; background-color: #12151f; border-radius: 16px; border: 1px solid #1e2436; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 20px 32px; text-align: center; border-bottom: 1px solid #1e2436;">
              <div style="display: inline-block; width: 44px; height: 44px; background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); border-radius: 12px; line-height: 44px; font-size: 22px; font-weight: bold; color: #ffffff; text-align: center;">
                ✦
              </div>
              <h1 style="margin: 16px 0 0 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">
                SPARK
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; color: #ffffff;">
                Verify your email address
              </h2>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #94a3b8;">
                Hi ${fullName || "there"},<br/>
                Welcome to SPARK! Please enter the 4-digit verification code below to verify your email address and activate your workspace account:
              </p>
              
              <!-- 4-Digit Code Box -->
              <div style="margin: 28px 0; text-align: center;">
                <div style="display: inline-block; padding: 18px 36px; background-color: #1a1e2e; border: 2px dashed #7c3aed; border-radius: 12px;">
                  <span style="font-family: monospace, 'Courier New', Courier; font-size: 34px; font-weight: 800; letter-spacing: 12px; color: #a78bfa; margin-left: 12px;">
                    ${otp}
                  </span>
                </div>
              </div>

              <p style="margin: 0 0 12px 0; font-size: 13px; line-height: 1.5; color: #94a3b8; text-align: center;">
                This one-time code will expire in <strong>10 minutes</strong>.
              </p>
              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #64748b; text-align: center;">
                If you did not request this verification code, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #0d0f17; border-top: 1px solid #1e2436; text-align: center; font-size: 12px; color: #64748b;">
              &copy; ${new Date().getFullYear()} SPARK Workspace Inc. All rights reserved.
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const textContent = `Your SPARK email verification code is: ${otp}\n\nThis one-time code expires in 10 minutes. If you did not create a SPARK account, please ignore this email.`;

  // Always log prominently in server console
  console.log(`\n============================================================`);
  console.log(`[SPARK 4-DIGIT OTP DISPATCH]`);
  console.log(`  Recipient: ${email} (${fullName})`);
  console.log(`  4-Digit Verification Code: [ ${otp} ]`);
  console.log(`  Expires in: 10 minutes`);
  console.log(`============================================================\n`);

  if (!transporter) {
    // When SMTP is not configured, console logging and devOtp return
    return {
      success: true,
      devOtp: process.env.NODE_ENV !== "production" ? otp : undefined,
    };
  }

  try {
    const fromAddress =
      process.env.SMTP_FROM || `"SPARK" <no-reply@sparkworkspace.com>`;

    await transporter.sendMail({
      from: fromAddress,
      to: email,
      subject: `Your SPARK Verification Code: ${otp}`,
      text: textContent,
      html: htmlContent,
    });

    return {
      success: true,
      devOtp: process.env.NODE_ENV !== "production" ? otp : undefined,
    };
  } catch (err: any) {
    console.error("Failed to send OTP email via SMTP transporter:", err);
    // Still return success if in development so registration flow is not blocked
    return {
      success: process.env.NODE_ENV !== "production",
      devOtp: process.env.NODE_ENV !== "production" ? otp : undefined,
    };
  }
}

/**
 * Dispatches a workspace invitation email.
 */
export async function sendWorkspaceInvitationEmail(
  params: SendInvitationParams
): Promise<{ success: boolean; devLink?: string }> {
  const { email, workspaceName, inviterName, role, acceptUrl } = params;
  const transporter = getTransporter();
  const isDev = process.env.NODE_ENV !== "production";

  if (!transporter) {
    if (isDev) {
      console.log(`[SPARK Dev Email Dispatch]`);
      console.log(`  To: ${email}`);
      console.log(`  Subject: You've been invited to join ${workspaceName} on SPARK`);
      console.log(`  Invited by: ${inviterName} as ${role}`);
      console.log(`  Accept URL: ${acceptUrl}`);
    }
    return {
      success: true,
      devLink: isDev ? acceptUrl : undefined,
    };
  }

  try {
    const fromAddress =
      process.env.SMTP_FROM || `"SPARK" <no-reply@sparkworkspace.com>`;

    await transporter.sendMail({
      from: fromAddress,
      to: email,
      subject: `You've been invited to join ${workspaceName} on SPARK`,
      text: `You have been invited by ${inviterName} to join ${workspaceName} as ${role}.\n\nAccept your invitation here: ${acceptUrl}`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
          <h2>Join ${workspaceName} on SPARK</h2>
          <p>${inviterName} has invited you to collaborate as <strong>${role}</strong>.</p>
          <p><a href="${acceptUrl}" style="display: inline-block; background-color: #7c3aed; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Accept Invitation</a></p>
        </div>
      `,
    });
    return { success: true };
  } catch (err) {
    console.error("Failed to send invitation email:", err);
    return { success: false };
  }
}
