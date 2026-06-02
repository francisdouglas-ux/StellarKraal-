"use client";
import { useEffect } from "react";

export interface Shortcut {
  key: string;       // e.g. "b", "r", "?"
  label: string;     // human-readable action name
  hint: string;      // e.g. "B"
  action: () => void;
}

/** Returns true when focus is inside an input, textarea, select, or dialog. */
function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = (el as HTMLElement).tagName.toLowerCase();
  if (["input", "textarea", "select"].includes(tag)) return true;
  // disable when any modal/dialog is open
  return !!document.querySelector('[role="dialog"]');
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Ignore modifier combos (Ctrl/Alt/Meta) to avoid browser conflicts
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (isInputFocused()) return;

      const match = shortcuts.find((s) => s.key === e.key);
      if (match) {
        e.preventDefault();
        match.action();
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcuts]);
}
