"use client";

import { useEffect, useState } from "react";
import { ToastItem, ToastVariant } from "./ToastContext";

const AUTO_DISMISS_MS = 5000;

const variantStyles: Record<ToastVariant, string> = {
  success: "bg-emerald-700 text-white",
  error: "bg-red-700 text-white",
  warning: "bg-amber-600 text-white",
  info: "bg-blue-700 text-white",
};

const variantIcons: Record<ToastVariant, string> = {
  success: "✅",
  error: "❌",
  warning: "⚠️",
  info: "ℹ️",
};

interface ToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

export default function Toast({ toast, onDismiss }: ToastProps) {
  const [exiting, setExiting] = useState(false);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / AUTO_DISMISS_MS) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        handleDismiss();
      }
    }, 50);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDismiss() {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`relative flex items-start gap-3 rounded-xl px-4 py-3 shadow-lg min-w-[16rem] max-w-sm transition-all duration-300 ${
        exiting ? "toast-exit" : "toast-enter"
      } ${variantStyles[toast.variant]}`}
    >
      <span className="text-lg leading-none mt-0.5" aria-hidden="true">
        {variantIcons[toast.variant]}
      </span>
      <p className="text-sm font-medium flex-1">{toast.message}</p>
      <button
        onClick={handleDismiss}
        aria-label="Close notification"
        className="text-white/80 hover:text-white transition text-lg leading-none"
      >
        ×
      </button>
      <div
        className="absolute bottom-0 left-0 h-1 bg-white/40 rounded-b-xl transition-all duration-100"
        style={{ width: `${progress}%` }}
        aria-hidden="true"
      />
    </div>
  );
}

