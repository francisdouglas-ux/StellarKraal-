/**
 * Repayment reminder background job.
 *
 * Runs every 6 hours. Sends an email reminder when a loan's health factor
 * drops below 1.3 (13_000 in scaled units). Deduplication ensures at most
 * one email is sent per loan per calendar day.
 *
 * Email sending is pluggable: configure SMTP_* env vars, or set
 * SENDGRID_API_KEY to use SendGrid.  If neither is set the email is
 * logged only (useful in development / test).
 */
import cron, { ScheduledTask } from 'node-cron';
import { createTransport } from 'nodemailer';
import logger from '../utils/logger';

// Health factor threshold below which a reminder is sent (1.3 × 10_000 scale)
const REMINDER_THRESHOLD = 13_000;
const SCALE = 10_000;

// Deduplication: loanId → ISO date string of last reminder sent
const lastReminderDate = new Map<string, string>();

interface LoanSummary {
  id: string;
  borrower: string; // email or wallet address used as fallback
  health_factor: number | null;
  amount: number;
  status: string;
  reminder_sent_at?: string | null;
}

// ── Email transport ───────────────────────────────────────────────────────────

function buildTransport() {
  if (process.env.SENDGRID_API_KEY) {
    return createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      auth: { user: 'apikey', pass: process.env.SENDGRID_API_KEY },
    });
  }
  if (process.env.SMTP_HOST) {
    return createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT ?? '587', 10),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  // No transport configured — log only
  return null;
}

/**
 * Send (or log) a repayment reminder for a loan.
 * Exported for unit testing.
 */
export async function sendReminderEmail(loan: LoanSummary): Promise<void> {
  const hf = loan.health_factor !== null
    ? (loan.health_factor / SCALE).toFixed(4)
    : 'N/A';
  const balance = (loan.amount / 1e7).toFixed(2);

  const subject = `[StellarKraal] Repayment reminder — Loan ${loan.id}`;
  const text = [
    `Hello,`,
    ``,
    `Your loan (ID: ${loan.id}) requires attention.`,
    ``,
    `  Health Factor : ${hf}`,
    `  Outstanding   : ${balance} XLM`,
    ``,
    `Please repay or add collateral to avoid liquidation.`,
    ``,
    `— StellarKraal`,
  ].join('\n');

  const transport = buildTransport();
  const to = process.env.REMINDER_EMAIL_FROM
    ? loan.borrower
    : loan.borrower; // use borrower address / email

  if (!transport) {
    logger.info('repaymentReminderJob: email (no transport)', { loanId: loan.id, to, subject });
    return;
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM ?? 'noreply@stellarkraal.example.com',
    to,
    subject,
    text,
  });
  logger.info('repaymentReminderJob: reminder sent', { loanId: loan.id, to });
}

/**
 * Check whether a reminder has already been sent today for a given loan.
 * Exported for unit testing.
 */
export function alreadySentToday(loanId: string, today: string): boolean {
  return lastReminderDate.get(loanId) === today;
}

/**
 * Mark a reminder as sent for today.
 * Exported for unit testing.
 */
export function markReminderSent(loanId: string, today: string): void {
  lastReminderDate.set(loanId, today);
}

/**
 * Core job logic. Accepts an optional loan-fetcher so it can be injected
 * in tests without a real database.
 */
export async function runRepaymentReminderJob(
  fetchLoans: () => LoanSummary[] = defaultFetchLoans,
): Promise<number> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const loans = fetchLoans();
  let sent = 0;

  for (const loan of loans) {
    if (loan.status !== 'active' && loan.status !== 'at_risk') continue;
    if (loan.health_factor === null) continue;
    if (loan.health_factor >= REMINDER_THRESHOLD) continue;
    if (alreadySentToday(loan.id, today)) continue;

    try {
      await sendReminderEmail(loan);
      markReminderSent(loan.id, today);
      sent++;
    } catch (err) {
      logger.error('repaymentReminderJob: failed to send reminder', {
        loanId: loan.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info('repaymentReminderJob: completed', { sent, today });
  return sent;
}

function defaultFetchLoans(): LoanSummary[] {
  try {
    // Lazy require to keep the job testable without a live DB
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { listLoans } = require('../db/store') as {
      listLoans: () => LoanSummary[];
    };
    return listLoans();
  } catch {
    return [];
  }
}

/**
 * Schedule the repayment reminder job to run every 6 hours.
 */
export function scheduleRepaymentReminderJob(): ScheduledTask {
  return cron.schedule('0 */6 * * *', async () => {
    try {
      await runRepaymentReminderJob();
    } catch (err) {
      logger.error('repaymentReminderJob: unhandled error', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
