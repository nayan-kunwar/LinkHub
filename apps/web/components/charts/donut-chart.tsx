"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { BreakdownSlice } from "@linkhub/shared";
import { formatNumber } from "@/lib/utils";

export function DonutChart({
  data,
  centerValue,
  centerLabel,
  height = 180,
}: {
  data: BreakdownSlice[];
  centerValue: string;
  centerLabel: string;
  height?: number;
}) {
  const chartData = data.filter((slice) => slice.count > 0);

  return (
    <div className="relative w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="count"
            nameKey="label"
            innerRadius="58%"
            outerRadius="86%"
            paddingAngle={2}
            stroke="none"
            isAnimationActive={false}
          >
            {chartData.map((slice) => (
              <Cell key={slice.key} fill={slice.color ?? "#7c3aed"} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: 10,
              border: "1px solid #ede9fe",
              boxShadow: "0 10px 24px -12px rgba(76,29,149,.35)",
              fontSize: 12,
            }}
            formatter={(value, name) => [`${formatNumber(Number(value))} clicks`, String(name)]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-extrabold text-zinc-900">{centerValue}</span>
        <span className="text-[11px] text-zinc-500">{centerLabel}</span>
      </div>
    </div>
  );
}
