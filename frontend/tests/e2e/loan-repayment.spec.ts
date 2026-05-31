import { test, expect } from "@playwright/test";

/**
 * E2E: Loan Repayment Flow
 *
 * This test is intentionally written to:
 * - mock wallet (Freighter) via window.__STELLARKRAAL_E2E__ (same pattern as existing spec)
 * - mock backend APIs via page.route
 * - verify UX steps + state changes in the UI
 *
 * NOTE:
 * - Adjust route URL globs or UI selectors if the app’s actual endpoints/labels differ.
 * - The test is scoped to issue #364 acceptance criteria only.
 */

const WALLET_ADDRESS = "GTESTWALLETADDRESS1234567890ABCDEFGH1234567890";
const LOAN_ID = "1";

// Keep values simple and explicit so assertions are stable
const ORIGINAL_OUTSTANDING = 200_000;
const REPAY_AMOUNT = 50_000;
const UPDATED_OUTSTANDING = ORIGINAL_OUTSTANDING - REPAY_AMOUNT;

type LoanDetail = {
  id: string;
  borrower: string;
  status: "active" | "closed" | string;
  outstandingBalance: number;
  createdAt: string;
};

type RepaymentTimelineItem = {
  type: "repayment" | string;
  amount: number;
  timestamp: string;
  txHash?: string;
};

test.describe("loan repayment flow (e2e)", () => {
  test("navigates to an active loan, initiates repayment, signs tx, updates outstanding balance, and shows repayment in history", async ({
    page,
  }) => {
    // --- In-memory "backend state" for this test ---
    const loan: LoanDetail = {
      id: LOAN_ID,
      borrower: WALLET_ADDRESS,
      status: "active",
      outstandingBalance: ORIGINAL_OUTSTANDING,
      createdAt: new Date("2026-05-26T00:00:00Z").toISOString(),
    };

    const repaymentTimeline: RepaymentTimelineItem[] = [];

    // --- Mock Freighter-like wallet bridge used by the app ---
    await page.addInitScript(
      ({ walletAddress }) => {
        // Basic call counters so we can assert "signing step" was actually invoked.
        const state = {
          signCalls: 0,
          submitCalls: 0,
        };

        // Align with existing test’s approach: window.__STELLARKRAAL_E2E__
        // The frontend should detect/use this during E2E.
        window.__STELLARKRAAL_E2E__ = {
          async isConnected() {
            return { isConnected: true };
          },
          async isAllowed() {
            return { isAllowed: true };
          },
          async setAllowed() {
            return { isAllowed: true };
          },
          async getAddress() {
            return { address: walletAddress };
          },
          async signTransaction(xdr: string) {
            state.signCalls += 1;
            // Expose state for assertions inside the test via page.evaluate later
            // (We can't directly read closure state otherwise)
            window.__STELLARKRAAL_E2E_STATE__ = state;
            return { signedTxXdr: `${xdr}-signed` };
          },
          async submitSignedXdr() {
            state.submitCalls += 1;
            window.__STELLARKRAAL_E2E_STATE__ = state;
            // Return a deterministic tx hash/id
            return "mock-tx-hash-repayment-1";
          },
        };
      },
      { walletAddress: WALLET_ADDRESS }
    );

    // --- Network mocks ---
    // Health factor (some pages may query this; keep it healthy to avoid UI blocking)
    await page.route("**/api/health/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ health_factor: 1.5 }),
      });
    });

    // Transactions endpoint used in other flows; safe default
    await page.route("**/api/transactions**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    });

    /**
     * Loan details endpoint:
     * Your app may use something like:
     * - GET /api/loans/:id
     * - GET /api/loan/:id
     * - etc.
     *
     * We mock a couple likely patterns. If your actual endpoint differs, update the glob.
     */
    await page.route("**/api/loans/**", async (route) => {
      // Return current loan state
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(loan),
      });
    });

    /**
     * Repayment history / timeline endpoint.
     * If the UI reads repayment timeline from a dedicated endpoint, mock it here.
     * Otherwise, the UI may embed it in the loan detail response; in that case,
     * you can remove this route and include timeline in the loan payload instead.
     */
    await page.route("**/api/loans/**/repayments**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(repaymentTimeline),
      });
    });

    /**
     * Repayment initiation endpoint:
     * Existing spec uses:
     * - **/api/loan/request  -> returns { xdr }
     *
     * We'll mirror that design with:
     * - **/api/loan/repay    -> returns { xdr }
     *
     * If your backend endpoint differs (e.g. /api/loan/repay/:id),
     * update the glob accordingly.
     */
    await page.route("**/api/loan/repay**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ xdr: "mock-repayment-xdr" }),
      });
    });

    /**
     * After submitting the signed XDR, the UI likely triggers:
     * - a "confirm" endpoint, or
     * - a refresh of loan details
     *
     * We'll treat "repayment successful" as: when the app requests loan details again,
     * it sees the updated outstanding balance. To make that happen, we update our
     * in-memory state immediately after the signing + submit calls occur.
     *
     * Because we can't directly hook into app-internal callbacks, we simulate it:
     * We assume the UI calls /api/loan/repay to get XDR, then signs/submits via wallet,
     * then re-fetches loan details and repayment history.
     *
     * So we update state right after the user clicks the "confirm repayment" action,
     * before we assert the updated UI.
     */

    // --- Begin flow: navigate to an active loan detail page ---
    // If your route is /loans/[id], this matches typical Next pages.
    await page.goto(`/loans/${LOAN_ID}`);

    // Acceptance criteria #1: active loan detail page
    // Keep selectors resilient: look for "Loan #1" or similar.
    await expect(page.getByText(new RegExp(`Loan\\s*#?${LOAN_ID}`, "i"))).toBeVisible();
    await expect(page.getByText(/active/i)).toBeVisible();

    // Also assert the initial outstanding balance is visible (format may vary).
    // We check numeric presence via regex rather than exact currency formatting.
    await expect(page.getByText(new RegExp(`${ORIGINAL_OUTSTANDING}`, "i"))).toBeVisible();

    // --- Initiate repayment and verify confirmation modal appears ---
    // Acceptance criteria #2
    const repayButton = page.getByRole("button", { name: /repay/i });
    await expect(repayButton).toBeVisible();
    await repayButton.click();

    // A confirmation modal should appear
    // Acceptance criteria #2: confirmation modal appears
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    await expect(modal.getByText(/repay/i)).toBeVisible();

    // If the modal includes amount input, fill it; otherwise, the repay action might be fixed.
    // We'll try a couple common patterns.
    const amountInput = modal.getByPlaceholder(/amount/i).or(modal.getByLabel(/amount/i));
    if (await amountInput.count()) {
      await amountInput.first().fill(String(REPAY_AMOUNT));
    }

    // --- Confirm the repayment and verify transaction signing step ---
    // Acceptance criteria #3
    const confirmButton = modal.getByRole("button", { name: /confirm/i }).or(modal.getByRole("button", { name: /repay/i }));
    await expect(confirmButton.first()).toBeVisible();

    // Click confirm (this should trigger /api/loan/repay -> wallet.signTransaction -> wallet.submitSignedXdr)
    await confirmButton.first().click();

    // Verify signing step occurred by checking our injected wallet state
    await expect
      .poll(async () => {
        return page.evaluate(() => (window as any).__STELLARKRAAL_E2E_STATE__?.signCalls || 0);
      })
      .toBeGreaterThan(0);

    await expect
      .poll(async () => {
        return page.evaluate(() => (window as any).__STELLARKRAAL_E2E_STATE__?.submitCalls || 0);
      })
      .toBeGreaterThan(0);

    // Update our in-memory "backend" state to reflect successful repayment
    // (This is what the UI should show after it refreshes).
    loan.outstandingBalance = UPDATED_OUTSTANDING;
    repaymentTimeline.unshift({
      type: "repayment",
      amount: REPAY_AMOUNT,
      timestamp: new Date("2026-05-28T00:00:00Z").toISOString(),
      txHash: "mock-tx-hash-repayment-1",
    });

    // If the modal closes after success, assert it disappears (best-effort; not an acceptance criterion)
    await expect(modal).toBeHidden({ timeout: 15_000 });

    // --- Verify outstanding balance is updated after successful repayment ---
    // Acceptance criteria #4
    // Wait for the page to reflect updated balance.
    await expect
      .poll(async () => {
        // Some UIs show outstanding balance in a labeled region; keep it flexible.
        const text = await page.locator("body").innerText();
        return text.includes(String(UPDATED_OUTSTANDING));
      })
      .toBeTruthy();

    // --- Verify repayment appears in repayment history timeline ---
    // Acceptance criteria #5
    // Check timeline section exists and includes a repayment entry.
    // We match "repayment" + amount, tolerant to formatting.
    const historySection = page.getByText(/repayment history|history|timeline/i).first();
    await expect(historySection).toBeVisible();

    await expect(page.getByText(/repayment/i)).toBeVisible();
    await expect(page.getByText(new RegExp(`${REPAY_AMOUNT}`, "i"))).toBeVisible();
  });
});