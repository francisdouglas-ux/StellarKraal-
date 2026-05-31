import { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type CardVariant = "default" | "highlighted" | "warning";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<CardVariant, string> = {
  default:
    "bg-cream-50 dark:bg-brown-800 border border-brown-100 dark:border-brown-700 shadow",
  highlighted:
    "bg-gold-50 dark:bg-brown-700 border border-gold-500 dark:border-gold-600 shadow-md",
  warning:
    "bg-warning-light dark:bg-brown-700 border border-warning dark:border-warning-dark shadow",
};

/**
 * Card — consistent data display container.
 *
 * Variants:
 * - `default`     — standard white card
 * - `highlighted` — gold-tinted card for featured data
 * - `warning`     — amber-tinted card for risk indicators
 *
 * Slots: `header`, `children` (body), `footer`
 */
export default function Card({
  variant = "default",
  header,
  footer,
  children,
  className,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl overflow-hidden",
        variantClasses[variant],
        className
      )}
      {...rest}
    >
      {header && (
        <div className="px-6 py-4 border-b border-brown-100 dark:border-brown-700">
          {header}
        </div>
      )}
      <div className="px-6 py-5">{children}</div>
      {footer && (
        <div className="px-6 py-4 border-t border-brown-100 dark:border-brown-700 bg-brown-50/40 dark:bg-brown-900/30">
          {footer}
        </div>
      )}
    </div>
  );
}
