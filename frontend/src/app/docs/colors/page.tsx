export const metadata = { title: "Color Palette — StellarKraal Design Tokens" };

const semanticTokens = [
  {
    group: "Primary",
    tokens: [
      { name: "color-primary",       cssVar: "--token-primary",       description: "Main brand / interactive" },
      { name: "color-primary-hover", cssVar: "--token-primary-hover", description: "Primary hover state" },
      { name: "color-on-primary",    cssVar: "--token-on-primary",    description: "Text on primary surface" },
    ],
  },
  {
    group: "Secondary",
    tokens: [
      { name: "color-secondary",       cssVar: "--token-secondary",       description: "Secondary brand / CTA" },
      { name: "color-secondary-hover", cssVar: "--token-secondary-hover", description: "Secondary hover state" },
      { name: "color-on-secondary",    cssVar: "--token-on-secondary",    description: "Text on secondary surface" },
    ],
  },
  {
    group: "Accent",
    tokens: [
      { name: "color-accent", cssVar: "--token-accent", description: "Highlight / focus ring" },
    ],
  },
  {
    group: "Danger",
    tokens: [
      { name: "color-danger",        cssVar: "--token-danger",        description: "Error / destructive action" },
      { name: "color-danger-subtle", cssVar: "--token-danger-subtle", description: "Error background / badge" },
      { name: "color-on-danger",     cssVar: "--token-on-danger",     description: "Text on danger surface" },
    ],
  },
  {
    group: "Success",
    tokens: [
      { name: "color-success",        cssVar: "--token-success",        description: "Positive outcome" },
      { name: "color-success-subtle", cssVar: "--token-success-subtle", description: "Success background / badge" },
      { name: "color-on-success",     cssVar: "--token-on-success",     description: "Text on success surface" },
    ],
  },
  {
    group: "Warning",
    tokens: [
      { name: "color-warning",        cssVar: "--token-warning",        description: "Caution / degraded state" },
      { name: "color-warning-subtle", cssVar: "--token-warning-subtle", description: "Warning background / badge" },
      { name: "color-on-warning",     cssVar: "--token-on-warning",     description: "Text on warning surface" },
    ],
  },
  {
    group: "Surface",
    tokens: [
      { name: "color-surface",       cssVar: "--token-surface",       description: "Page background" },
      { name: "color-surface-raised", cssVar: "--token-surface-raised", description: "Card / panel background" },
    ],
  },
  {
    group: "Text",
    tokens: [
      { name: "color-text",         cssVar: "--token-text",         description: "Primary text" },
      { name: "color-text-subtle",  cssVar: "--token-text-subtle",  description: "Secondary text" },
      { name: "color-text-muted",   cssVar: "--token-text-muted",   description: "Placeholder / disabled text" },
      { name: "color-text-inverse", cssVar: "--token-text-inverse", description: "Text on dark surfaces" },
    ],
  },
  {
    group: "Border",
    tokens: [
      { name: "color-border",       cssVar: "--token-border",       description: "Default divider / outline" },
      { name: "color-border-strong", cssVar: "--token-border-strong", description: "Emphasis border" },
    ],
  },
];

function Swatch({ cssVar }: { cssVar: string }) {
  return (
    <span
      className="inline-block w-8 h-8 rounded border border-black/10 shrink-0"
      style={{ backgroundColor: `var(${cssVar})` }}
      aria-hidden
    />
  );
}

export default function ColorPalettePage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-12 space-y-12">
      <div>
        <h1 className="text-h1 mb-2">Color Palette</h1>
        <p className="text-body" style={{ color: "var(--token-text-subtle)" }}>
          Semantic design tokens defined in{" "}
          <code className="font-mono text-sm bg-black/5 px-1 rounded">tailwind.config.js</code>.
          Use token names (e.g. <code className="font-mono text-sm bg-black/5 px-1 rounded">bg-color-primary</code>)
          instead of raw Tailwind color classes. Dark mode variants are applied automatically via CSS custom properties.
        </p>
      </div>

      {semanticTokens.map(({ group, tokens }) => (
        <section key={group}>
          <h2 className="text-h3 mb-4 border-b pb-2" style={{ borderColor: "var(--token-border)" }}>
            {group}
          </h2>
          <div className="space-y-3">
            {tokens.map(({ name, cssVar, description }) => (
              <div key={name} className="flex items-center gap-4">
                <Swatch cssVar={cssVar} />
                <div className="flex-1 min-w-0">
                  <p className="text-label font-mono">{name}</p>
                  <p className="text-caption">{description}</p>
                </div>
                <code
                  className="text-caption font-mono shrink-0"
                  style={{ color: "var(--token-text-muted)" }}
                >
                  {cssVar}
                </code>
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
