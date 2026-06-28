import { render, screen } from "@testing-library/react";
import SkipToContent from "../components/SkipToContent";

test("skip link points to #main-content and is visually hidden", () => {
  const { container } = render(<SkipToContent />);
  const link = screen.getByRole("link", { name: /skip to content/i });
  expect(link).toHaveAttribute("href", "#main-content");
  expect(container.querySelector("a")!.className).toMatch(/sr-only/);
});
