"use client";

import { useContext } from "react";
import { ToastContext, ToastVariant } from "./ToastContext";

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }

  const { addToast } = context;

  return {
    success: (message: string) => addToast(message, "success" as ToastVariant),
    error: (message: string) => addToast(message, "error" as ToastVariant),
    warning: (message: string) => addToast(message, "warning" as ToastVariant),
    info: (message: string) => addToast(message, "info" as ToastVariant),
  };
}

