"use client";
import { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

export type ModalSize = "sm" | "md" | "lg";

const sizeClasses: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
};

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Modal body content */
  children: React.ReactNode;
  /** Optional footer content (action buttons) */
  footer?: React.ReactNode;
  size?: ModalSize;
  /** Element id for aria-labelledby — auto-generated if omitted */
  titleId?: string;
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  titleId = "modal-title",
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<Element | null>(null);

  // Remember the element that opened the modal so we can return focus on close
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement;
    } else {
      (triggerRef.current as HTMLElement | null)?.focus();
    }
  }, [open]);

  // Focus the close button when the modal opens
  useEffect(() => {
    if (open) {
      firstFocusableRef.current?.focus();
    }
  }, [open]);

  // Escape key dismissal
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") onClose();

      // Focus trap
      if (e.key === "Tab" && overlayRef.current) {
        const focusable = Array.from(
          overlayRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => !el.hasAttribute("disabled"));

        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [open, onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      aria-modal="true"
      role="dialog"
      aria-labelledby={titleId}
      // Backdrop click
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      ref={overlayRef}
    >
      <div
        className={`relative w-full ${sizeClasses[size]} rounded-2xl bg-white shadow-xl flex flex-col max-h-[90vh]`}
        // Prevent clicks inside from closing
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brown-100">
          <h2 id={titleId} className="text-lg font-bold text-brown-700">
            {title}
          </h2>
          <button
            ref={firstFocusableRef}
            onClick={onClose}
            aria-label="Close dialog"
            className="text-brown-400 hover:text-brown-700 transition text-2xl leading-none focus:outline-none focus:ring-2 focus:ring-gold/40 rounded"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto flex-1">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-brown-100 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
