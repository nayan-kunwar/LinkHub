"use client";

import type { RangeDays } from "@/lib/analytics";
import { RANGE_OPTIONS } from "@/lib/analytics";
import { Select } from "./ui/input";

export function RangeSelect({
  value,
  onChange,
  id = "range",
  className,
}: {
  value: RangeDays;
  onChange: (value: RangeDays) => void;
  id?: string;
  className?: string;
}) {
  return (
    <>
      <label htmlFor={id} className="sr-only">
        Date range
      </label>
      <Select
        id={id}
        value={value}
        onChange={(event) => onChange(Number(event.target.value) as RangeDays)}
        className={className}
      >
        {RANGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </>
  );
}
