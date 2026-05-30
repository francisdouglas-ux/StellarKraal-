import type { Meta, StoryObj } from "@storybook/react";
import Card from "./Card";

/**
 * `Card` is the single container for all data display across the dashboard.
 * It standardises padding, border radius, shadow, and header/footer styling so
 * every data surface looks consistent in both light and dark mode.
 *
 * **Slots**
 * - `header` — optional title row (rendered above a divider)
 * - `children` — the body (always present)
 * - `footer` — optional meta row (rendered below a divider, subtly tinted)
 *
 * **Variants**
 * - `default` — standard surface for most data
 * - `highlighted` — gold-tinted, for featured/primary metrics
 * - `warning` — amber-tinted, for risk indicators (e.g. liquidation risk)
 *
 * Any extra props (`aria-busy`, `aria-label`, `id`, …) are forwarded to the
 * underlying element, which is how the skeleton variants mark themselves busy.
 */
const meta: Meta<typeof Card> = {
  title: "Components/Card",
  component: Card,
  parameters: { layout: "padded" },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "highlighted", "warning"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: "Standard card body — used for most data surfaces.",
  },
};

export const Highlighted: Story = {
  args: {
    variant: "highlighted",
    children: "Highlighted card — for featured or primary metrics.",
  },
};

export const Warning: Story = {
  args: {
    variant: "warning",
    children: "Warning card — for risk indicators like liquidation risk.",
  },
};

export const WithHeaderAndFooter: Story = {
  args: {
    header: <h2 className="text-xl font-semibold text-brown-700">Loan #42</h2>,
    children: (
      <div className="space-y-1">
        <p className="text-brown-700 font-semibold">1,250.00 XLM</p>
        <p className="text-sm text-brown-500">Borrowed against 3 cattle</p>
      </div>
    ),
    footer: <p className="text-xs text-brown-500 font-mono">ID: 8f3a91c2…</p>,
  },
};

/** All three variants side by side for quick visual comparison. */
export const AllVariants: Story = {
  render: () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card header={<span className="font-semibold text-brown-700">Default</span>}>
        Standard data surface.
      </Card>
      <Card
        variant="highlighted"
        header={<span className="font-semibold text-brown-700">Highlighted</span>}
      >
        Featured / primary metric.
      </Card>
      <Card
        variant="warning"
        header={<span className="font-semibold text-warning-dark">Warning</span>}
      >
        Risk indicator.
      </Card>
    </div>
  ),
};

/**
 * Dark mode — Tailwind uses `darkMode: "class"`, so wrapping in `.dark`
 * activates every dark variant the Card defines.
 */
export const DarkMode: Story = {
  render: () => (
    <div className="dark bg-brown-900 p-6 rounded-2xl">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card header={<span className="font-semibold text-cream-50">Default</span>}>
          <span className="text-cream-50">Standard data surface.</span>
        </Card>
        <Card
          variant="highlighted"
          header={<span className="font-semibold text-cream-50">Highlighted</span>}
        >
          <span className="text-cream-50">Featured / primary metric.</span>
        </Card>
        <Card
          variant="warning"
          header={<span className="font-semibold text-warning-dark">Warning</span>}
        >
          <span className="text-cream-50">Risk indicator.</span>
        </Card>
      </div>
    </div>
  ),
};
