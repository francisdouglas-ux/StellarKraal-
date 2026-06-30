/**
 * Unit tests for repaymentReminderJob.
 * Mocks email sending and verifies deduplication logic.
 */
import {
  runRepaymentReminderJob,
  alreadySentToday,
  markReminderSent,
  sendReminderEmail,
} from '../../src/jobs/repaymentReminderJob';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test' }),
  })),
}));

const TODAY = new Date().toISOString().slice(0, 10);

const mockLoan = (overrides = {}) => ({
  id: 'loan-1',
  borrower: 'test@example.com',
  health_factor: 12_000, // below 13_000 threshold
  amount: 100_000_000, // 10 XLM
  status: 'active',
  ...overrides,
});

describe('repaymentReminderJob', () => {
  describe('alreadySentToday / markReminderSent', () => {
    it('returns false before any reminder is sent', () => {
      expect(alreadySentToday('new-loan', TODAY)).toBe(false);
    });

    it('returns true after marking sent', () => {
      markReminderSent('marked-loan', TODAY);
      expect(alreadySentToday('marked-loan', TODAY)).toBe(true);
    });

    it('returns false for a different date', () => {
      markReminderSent('date-loan', '2026-01-01');
      expect(alreadySentToday('date-loan', TODAY)).toBe(false);
    });
  });

  describe('runRepaymentReminderJob', () => {
    it('sends reminder for loan below threshold', async () => {
      const loan = mockLoan({ id: 'job-loan-1' });
      const sent = await runRepaymentReminderJob(() => [loan]);
      expect(sent).toBe(1);
    });

    it('skips loan above threshold', async () => {
      const loan = mockLoan({ id: 'job-loan-2', health_factor: 15_000 });
      const sent = await runRepaymentReminderJob(() => [loan]);
      expect(sent).toBe(0);
    });

    it('skips loan with null health_factor', async () => {
      const loan = mockLoan({ id: 'job-loan-3', health_factor: null });
      const sent = await runRepaymentReminderJob(() => [loan]);
      expect(sent).toBe(0);
    });

    it('skips non-active/at_risk loan status', async () => {
      const loan = mockLoan({ id: 'job-loan-4', status: 'repaid' });
      const sent = await runRepaymentReminderJob(() => [loan]);
      expect(sent).toBe(0);
    });

    it('deduplicates: does not send twice on the same day', async () => {
      const loan = mockLoan({ id: 'dedup-loan' });
      // First run
      await runRepaymentReminderJob(() => [loan]);
      // Second run same day — should be skipped
      const sent = await runRepaymentReminderJob(() => [loan]);
      expect(sent).toBe(0);
    });
  });

  describe('sendReminderEmail', () => {
    it('logs when no transport is configured (no env vars)', async () => {
      delete process.env.SENDGRID_API_KEY;
      delete process.env.SMTP_HOST;
      // Should not throw — logs only
      await expect(sendReminderEmail(mockLoan({ id: 'email-loan' }))).resolves.toBeUndefined();
    });
  });
});
