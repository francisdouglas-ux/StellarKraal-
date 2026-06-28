"use client";
import { useEffect, useRef, useCallback } from "react";

/**
 * Calls `fn` immediately, then every `interval` ms.
 * Pauses when the tab is hidden; resumes (and fires immediately) when visible again.
 * Cleans up on unmount.
 */
export function usePolling(fn: () => void, interval: number) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const tick = useCallback(() => {
    if (document.visibilityState === "visible") fnRef.current();
  }, []);

  useEffect(() => {
    fnRef.current(); // initial fetch

    const id = setInterval(tick, interval);

    const onVisibility = () => {
      if (document.visibilityState === "visible") fnRef.current();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [tick, interval]);
}
