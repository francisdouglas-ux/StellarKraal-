export default function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:font-semibold focus:text-sm"
      style={{
        backgroundColor: "var(--color-nav-bg)",
        color: "var(--color-text)",
        border: "2px solid var(--color-border-strong)",
      }}
    >
      Skip to content
    </a>
  );
}
