import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { logger } from '../utils/logger.js';

// Email configuration from environment
const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.ethereal.email';
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || '587', 10);
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@mosaicgame.com';
const EMAIL_ENABLED = process.env.EMAIL_ENABLED !== 'false';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

let transporter: Transporter | null = null;

/**
 * Initialize the email transporter.
 * In development, uses Ethereal for testing if no SMTP configured.
 */
export async function initializeEmailService(): Promise<void> {
  if (!EMAIL_ENABLED) {
    logger.info('Email service disabled');
    return;
  }

  try {
    if (EMAIL_USER && EMAIL_PASS) {
      // Use configured SMTP
      transporter = nodemailer.createTransport({
        host: EMAIL_HOST,
        port: EMAIL_PORT,
        secure: EMAIL_PORT === 465,
        auth: {
          user: EMAIL_USER,
          pass: EMAIL_PASS,
        },
      });
    } else if (process.env.NODE_ENV !== 'production') {
      // Create test account for development
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      logger.info(`Email test account created: ${testAccount.user}`);
      logger.info('Preview emails at: https://ethereal.email');
    } else {
      logger.warn('Email service not configured for production');
    }

    if (transporter) {
      await transporter.verify();
      logger.info('Email service initialized successfully');
    }
  } catch (error) {
    logger.error(`Failed to initialize email service: ${error}`);
    transporter = null;
  }
}

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Send an email.
 * Returns true if sent successfully, false otherwise.
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  if (!EMAIL_ENABLED) {
    logger.debug(`Email disabled, skipping: ${options.subject} to ${options.to}`);
    return false;
  }

  if (!transporter) {
    logger.warn('Email transporter not initialized');
    return false;
  }

  try {
    const info = await transporter.sendMail({
      from: EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    logger.info(`Email sent: ${info.messageId}`);

    // Log preview URL for Ethereal test emails
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      logger.info(`Preview URL: ${previewUrl}`);
    }

    return true;
  } catch (error) {
    logger.error(`Failed to send email: ${error}`);
    return false;
  }
}

// Email template helpers
function wrapInTemplate(content: string, title: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4f46e5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
    .button { display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
    .highlight { background: #fef3c7; padding: 10px; border-radius: 4px; margin: 10px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Mosaic Matrix Game</h1>
  </div>
  <div class="content">
    ${content}
  </div>
  <div class="footer">
    <p>This is an automated message from Mosaic Matrix Game.</p>
    <p>To change your notification preferences, visit your profile settings.</p>
  </div>
</body>
</html>
`;
}

// Game notification emails

export async function sendGameInviteEmail(
  to: string,
  gameName: string,
  inviterName: string,
  gameId: string
): Promise<boolean> {
  const joinUrl = `${APP_URL}/games/${gameId}/join`;
  const subject = `You're invited to join "${gameName}"`;
  const text = `${inviterName} has invited you to join a game of Mosaic Matrix Game called "${gameName}". Join here: ${joinUrl}`;
  const html = wrapInTemplate(
    `
    <h2>You're Invited!</h2>
    <p><strong>${inviterName}</strong> has invited you to join a game called <strong>"${gameName}"</strong>.</p>
    <p>Mosaic Matrix Game is a collaborative storytelling game where players propose actions and determine outcomes through voting and token drawing.</p>
    <a href="${joinUrl}" class="button">Join Game</a>
    <p style="font-size: 12px; color: #6b7280;">Or copy this link: ${joinUrl}</p>
    `,
    subject
  );

  return sendEmail({ to, subject, text, html });
}

export async function sendGameStartedEmail(
  to: string,
  gameName: string,
  gameId: string
): Promise<boolean> {
  const gameUrl = `${APP_URL}/games/${gameId}`;
  const subject = `Game "${gameName}" has started!`;
  const text = `The game "${gameName}" has started. It's time to propose your first action! View the game: ${gameUrl}`;
  const html = wrapInTemplate(
    `
    <h2>Game Started!</h2>
    <p>The game <strong>"${gameName}"</strong> has started.</p>
    <p>It's time to propose your first action. Head over to the game to begin!</p>
    <a href="${gameUrl}" class="button">Go to Game</a>
    `,
    subject
  );

  return sendEmail({ to, subject, text, html });
}

export async function sendActionProposedEmail(
  to: string,
  gameName: string,
  gameId: string,
  initiatorName: string,
  actionDescription: string
): Promise<boolean> {
  const gameUrl = `${APP_URL}/games/${gameId}`;
  const subject = `New action proposed in "${gameName}"`;
  const text = `${initiatorName} has proposed a new action in "${gameName}": "${actionDescription}". View and add your arguments: ${gameUrl}`;
  const html = wrapInTemplate(
    `
    <h2>New Action Proposed</h2>
    <p><strong>${initiatorName}</strong> has proposed a new action in <strong>"${gameName}"</strong>:</p>
    <div class="highlight">
      <p>"${actionDescription}"</p>
    </div>
    <p>It's time to add your arguments for or against this action.</p>
    <a href="${gameUrl}" class="button">Add Arguments</a>
    `,
    subject
  );

  return sendEmail({ to, subject, text, html });
}

export async function sendVotingStartedEmail(
  to: string,
  gameName: string,
  gameId: string,
  actionDescription: string
): Promise<boolean> {
  const gameUrl = `${APP_URL}/games/${gameId}`;
  const subject = `Voting has started in "${gameName}"`;
  const text = `Voting has started for the action "${actionDescription}" in "${gameName}". Cast your vote: ${gameUrl}`;
  const html = wrapInTemplate(
    `
    <h2>Time to Vote!</h2>
    <p>The argumentation phase has ended for <strong>"${gameName}"</strong>.</p>
    <p>It's time to vote on the proposed action:</p>
    <div class="highlight">
      <p>"${actionDescription}"</p>
    </div>
    <p>Choose whether you think this action is likely to succeed, likely to fail, or uncertain.</p>
    <a href="${gameUrl}" class="button">Cast Your Vote</a>
    `,
    subject
  );

  return sendEmail({ to, subject, text, html });
}

export async function sendResolutionReadyEmail(
  to: string,
  gameName: string,
  gameId: string,
  actionDescription: string
): Promise<boolean> {
  const gameUrl = `${APP_URL}/games/${gameId}`;
  const subject = `Ready to draw tokens in "${gameName}"`;
  const text = `All votes are in for "${actionDescription}" in "${gameName}". As the initiator, you can now draw tokens to determine the outcome: ${gameUrl}`;
  const html = wrapInTemplate(
    `
    <h2>Draw Tokens!</h2>
    <p>All players have voted on your action in <strong>"${gameName}"</strong>:</p>
    <div class="highlight">
      <p>"${actionDescription}"</p>
    </div>
    <p>As the initiator, you can now draw tokens to determine the outcome!</p>
    <a href="${gameUrl}" class="button">Draw Tokens</a>
    `,
    subject
  );

  return sendEmail({ to, subject, text, html });
}

export async function sendNarrationNeededEmail(
  to: string,
  gameName: string,
  gameId: string,
  resultType: string,
  resultValue: number
): Promise<boolean> {
  const gameUrl = `${APP_URL}/games/${gameId}`;
  const resultText =
    resultValue > 0 ? `+${resultValue}` : resultValue.toString();
  const subject = `Narrate the outcome in "${gameName}" (${resultType})`;
  const text = `The tokens have been drawn in "${gameName}". Result: ${resultType} (${resultText}). Narrate what happens: ${gameUrl}`;
  const html = wrapInTemplate(
    `
    <h2>Narrate the Outcome</h2>
    <p>The tokens have been drawn in <strong>"${gameName}"</strong>!</p>
    <div class="highlight">
      <p><strong>Result:</strong> ${resultType} (${resultText})</p>
    </div>
    <p>It's time to narrate what happens based on this outcome.</p>
    <a href="${gameUrl}" class="button">Write Narration</a>
    `,
    subject
  );

  return sendEmail({ to, subject, text, html });
}

export async function sendRoundSummaryNeededEmail(
  to: string,
  gameName: string,
  gameId: string,
  roundNumber: number,
  actionsCompleted: number
): Promise<boolean> {
  const gameUrl = `${APP_URL}/games/${gameId}`;
  const subject = `Round ${roundNumber} complete in "${gameName}" - Summary needed`;
  const text = `Round ${roundNumber} is complete in "${gameName}" with ${actionsCompleted} actions. Write a round summary: ${gameUrl}`;
  const html = wrapInTemplate(
    `
    <h2>Round ${roundNumber} Complete!</h2>
    <p>All <strong>${actionsCompleted}</strong> actions have been completed in round ${roundNumber} of <strong>"${gameName}"</strong>.</p>
    <p>It's time to write a summary of what happened this round.</p>
    <a href="${gameUrl}" class="button">Write Round Summary</a>
    `,
    subject
  );

  return sendEmail({ to, subject, text, html });
}

export async function sendNewRoundEmail(
  to: string,
  gameName: string,
  gameId: string,
  roundNumber: number
): Promise<boolean> {
  const gameUrl = `${APP_URL}/games/${gameId}`;
  const subject = `Round ${roundNumber} has started in "${gameName}"`;
  const text = `Round ${roundNumber} has begun in "${gameName}". Time to propose your action for this round: ${gameUrl}`;
  const html = wrapInTemplate(
    `
    <h2>Round ${roundNumber} Begins!</h2>
    <p>A new round has started in <strong>"${gameName}"</strong>.</p>
    <p>Each player can now propose one action for this round.</p>
    <a href="${gameUrl}" class="button">Propose Action</a>
    `,
    subject
  );

  return sendEmail({ to, subject, text, html });
}

export async function sendTimeoutWarningEmail(
  to: string,
  gameName: string,
  gameId: string,
  phase: string,
  hoursRemaining: number
): Promise<boolean> {
  const gameUrl = `${APP_URL}/games/${gameId}`;
  const subject = `Action needed in "${gameName}" - ${hoursRemaining}h remaining`;
  const text = `The ${phase} phase in "${gameName}" will timeout in ${hoursRemaining} hours. Take action: ${gameUrl}`;
  const html = wrapInTemplate(
    `
    <h2>Don't Miss Out!</h2>
    <p>The <strong>${phase}</strong> phase in <strong>"${gameName}"</strong> will automatically advance in <strong>${hoursRemaining} hours</strong>.</p>
    <p>Make sure to take action before the timeout!</p>
    <a href="${gameUrl}" class="button">Go to Game</a>
    `,
    subject
  );

  return sendEmail({ to, subject, text, html });
}

export async function sendTimeoutOccurredEmail(
  to: string,
  gameName: string,
  gameId: string,
  phase: string,
  wasAutoVoted: boolean
): Promise<boolean> {
  const gameUrl = `${APP_URL}/games/${gameId}`;
  const subject = `Phase timeout in "${gameName}"`;
  const autoVoteText = wasAutoVoted
    ? ' An UNCERTAIN vote was automatically cast on your behalf.'
    : '';
  const text = `The ${phase} phase in "${gameName}" has timed out and automatically advanced.${autoVoteText} View the game: ${gameUrl}`;
  const html = wrapInTemplate(
    `
    <h2>Phase Timeout</h2>
    <p>The <strong>${phase}</strong> phase in <strong>"${gameName}"</strong> has timed out and automatically advanced.</p>
    ${wasAutoVoted ? '<p><strong>Note:</strong> An UNCERTAIN vote was automatically cast on your behalf.</p>' : ''}
    <a href="${gameUrl}" class="button">View Game</a>
    `,
    subject
  );

  return sendEmail({ to, subject, text, html });
}
