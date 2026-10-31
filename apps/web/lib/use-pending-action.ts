"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Serializes mutations triggered from one view.
 *
 * `run` ignores a second call while an action is already in flight, and exposes
 * the active key so buttons can show a spinner and disable themselves. Use a
 * distinct key per action when a view has several independent mutations.
 */
export function usePendingAction() {
  const [pending, setPending] = useState<string | null>(null);
  const inFlight = useRef(false);

  const run = useCallback(
    async <T,>(key: string, action: () => Promise<T>): Promise<T | undefined> => {
      if (inFlight.current) return undefined;
      inFlight.current = true;
      setPending(key);
      try {
        return await action();
      } finally {
        inFlight.current = false;
        setPending(null);
      }
    },
    [],
  );

  return { pending, isPending: pending !== null, run };
}
