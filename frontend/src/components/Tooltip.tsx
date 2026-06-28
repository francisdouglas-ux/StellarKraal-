"use client";
import { ReactNode } from "react";

interface Props {
  hint: string;
  children: ReactNode;
}

/**
 * Wraps a child element and shows a keyboard shortcut hint tooltip on hover.
 * Usage: <Tooltip hint="B"><button>Borrow</button></Tooltip>
 */
export default function Tooltip({ hint, children }: Props) {
  return (
    <span className="relative group inline-flex w-full">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap
          bg-brown text-cream text-xs font-mono px-2 py-0.5 rounded shadow
          opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {hint}
      </span>
    </span>
  );
}
