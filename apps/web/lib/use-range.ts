"use client";

import { useEffect, useState } from "react";
import type { RangeDays } from "./analytics";

const STORAGE_KEY = "linkhub-range";
const VALID_RANGES: RangeDays[] = [7, 30, 90];

export function useRange(defaultRange: RangeDays = 30): [RangeDays, (range: RangeDays) => void] {
  const [range, setRange] = useState<RangeDays>(defaultRange);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(STORAGE_KEY));
    if (VALID_RANGES.includes(stored as RangeDays)) {
      setRange(stored as RangeDays);
    }
  }, []);

  const update = (value: RangeDays) => {
    setRange(value);
    window.localStorage.setItem(STORAGE_KEY, String(value));
  };

  return [range, update];
}
