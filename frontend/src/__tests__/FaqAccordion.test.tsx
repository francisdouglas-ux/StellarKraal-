import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FaqPage from "../app/help/faq/page";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn() }),
  usePathname: () => "/help/faq",
}));

jest.mock("next/link", () => {
  const Link = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  );
  Link.displayName = "Link";
  return Link;
});

test("all FAQ items are collapsed by default", () => {
  render(<FaqPage />);
  const buttons = screen.getAllByRole("button", { name: /\?/ });
  buttons.forEach((btn) => expect(btn).toHaveAttribute("aria-expanded", "false"));
});

test("clicking a question expands it and sets aria-expanded=true", async () => {
  render(<FaqPage />);
  const [first] = screen.getAllByRole("button", { name: /\?/ });
  await userEvent.click(first);
  expect(first).toHaveAttribute("aria-expanded", "true");
});

test("clicking an open question collapses it", async () => {
  render(<FaqPage />);
  const [first] = screen.getAllByRole("button", { name: /\?/ });
  await userEvent.click(first);
  await userEvent.click(first);
  expect(first).toHaveAttribute("aria-expanded", "false");
});

test("clicking a second question closes the first (single open)", async () => {
  render(<FaqPage />);
  const buttons = screen.getAllByRole("button", { name: /\?/ });
  await userEvent.click(buttons[0]);
  await userEvent.click(buttons[1]);
  expect(buttons[0]).toHaveAttribute("aria-expanded", "false");
  expect(buttons[1]).toHaveAttribute("aria-expanded", "true");
});

test("each toggle button has aria-controls pointing to a panel", () => {
  render(<FaqPage />);
  screen.getAllByRole("button", { name: /\?/ }).forEach((btn) => {
    const panelId = btn.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    expect(document.getElementById(panelId!)).toBeTruthy();
  });
});
