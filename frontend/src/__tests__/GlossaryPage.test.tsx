import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GlossaryPage from "../app/help/glossary/page";

jest.mock("../components/Navbar", () => {
  const Navbar = () => <nav />;
  Navbar.displayName = "Navbar";
  return Navbar;
});

test("shows all terms by default", () => {
  render(<GlossaryPage />);
  expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThan(0);
});

test("filters terms by search query", async () => {
  render(<GlossaryPage />);
  const input = screen.getByRole("searchbox", { name: /filter glossary/i });
  await userEvent.type(input, "health");
  expect(screen.getByText(/health factor/i)).toBeTruthy();
  // non-matching term should not appear
  expect(screen.queryByText(/^LTV/i)).toBeNull();
});

test("shows empty state when no terms match", async () => {
  render(<GlossaryPage />);
  const input = screen.getByRole("searchbox", { name: /filter glossary/i });
  await userEvent.type(input, "zzznomatch");
  expect(screen.getByText(/no terms match/i)).toBeTruthy();
});
