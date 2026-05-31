import {
  transition,
  allowedTransitions,
  InvalidTransitionError,
  LoanStatus,
  TransitionRecord,
} from "./loanStateMachine";

describe("LoanStateMachine", () => {
  // ── valid transitions ──────────────────────────────────────────────────
  it("pending → active", () => {
    const h: TransitionRecord[] = [];
    expect(transition("pending", "active", h)).toBe("active");
    expect(h).toHaveLength(1);
    expect(h[0].from).toBe("pending");
    expect(h[0].to).toBe("active");
  });

  it("active → repaid", () => {
    const h: TransitionRecord[] = [];
    expect(transition("active", "repaid", h)).toBe("repaid");
  });

  it("active → liquidated", () => {
    const h: TransitionRecord[] = [];
    expect(transition("active", "liquidated", h)).toBe("liquidated");
  });

  // ── invalid transitions ────────────────────────────────────────────────
  const invalid: [LoanStatus, LoanStatus][] = [
    ["pending", "repaid"],
    ["pending", "liquidated"],
    ["pending", "pending"],
    ["active", "pending"],
    ["active", "active"],
    ["repaid", "active"],
    ["repaid", "liquidated"],
    ["repaid", "pending"],
    ["liquidated", "active"],
    ["liquidated", "repaid"],
    ["liquidated", "pending"],
  ];

  it.each(invalid)("throws InvalidTransitionError: %s → %s", (from, to) => {
    expect(() => transition(from, to, [])).toThrow(InvalidTransitionError);
    expect(() => transition(from, to, [])).toThrow(
      `Invalid loan transition: ${from} → ${to}`
    );
  });

  // ── terminal states ────────────────────────────────────────────────────
  it("repaid is terminal — no allowed transitions", () => {
    expect(allowedTransitions("repaid")).toEqual([]);
  });

  it("liquidated is terminal — no allowed transitions", () => {
    expect(allowedTransitions("liquidated")).toEqual([]);
  });

  // ── history logging ────────────────────────────────────────────────────
  it("logs full transition history", () => {
    const h: TransitionRecord[] = [];
    transition("pending", "active", h);
    transition("active", "repaid", h);
    expect(h).toHaveLength(2);
    expect(h[0]).toMatchObject({ from: "pending", to: "active" });
    expect(h[1]).toMatchObject({ from: "active", to: "repaid" });
  });

  it("history entries include ISO timestamp", () => {
    const h: TransitionRecord[] = [];
    transition("pending", "active", h);
    expect(h[0].at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("history not mutated on invalid transition", () => {
    const h: TransitionRecord[] = [];
    expect(() => transition("pending", "repaid", h)).toThrow();
    expect(h).toHaveLength(0);
  });

  // ── allowedTransitions ─────────────────────────────────────────────────
  it("allowedTransitions(pending) = [active]", () => {
    expect(allowedTransitions("pending")).toEqual(["active"]);
  });

  it("allowedTransitions(active) = [repaid, liquidated]", () => {
    expect(allowedTransitions("active")).toEqual(["repaid", "liquidated"]);
  });

  // ── InvalidTransitionError identity ───────────────────────────────────
  it("error name is InvalidTransitionError", () => {
    try {
      transition("repaid", "active", []);
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidTransitionError);
      expect((e as Error).name).toBe("InvalidTransitionError");
    }
  });
});
