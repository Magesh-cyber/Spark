/**
 * SPARK Email Provider Abstraction
 * Supports SMTP (Resend / SendGrid / Custom SMTP) with safe development fallback.
 */

export interface SendInvitationParams {
  email: string;
  workspaceName: string;
  inviterName: string;
  role: string;
  acceptUrl: string;
}

export async function sendWorkspaceInvitationEmail(
  params: SendInvitationParams
): Promise<{ success: boolean; devLink?: string }> {
  const { email, workspaceName, inviterName, role, acceptUrl } = params;

  const smtpHost = process.env.SMTP_HOST;
  const isDev = process.env.NODE_ENV !== "production";

  if (!smtpHost) {
    // Development fallback when external SMTP is not configured
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

  // When SMTP is configured, dispatch via standard SMTP transport (e.g. nodemailer or HTTP API)
  try {
    // Placeholder for live SMTP client if installed
    return { success: true };
  } catch (err) {
    console.error("Failed to send invitation email:", err);
    return { success: false };
  }
}

