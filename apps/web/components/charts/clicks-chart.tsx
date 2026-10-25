"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyPoint } from "@linkhub/shared";
import { formatSeriesLabel } from "@/lib/analytics";
import { formatNumber } from "@/lib/utils";

export function ClicksChart({
  data,
  height = 224,
  rangeDays,
}: {
  data: DailyPoint[];
  height?: number;
  rangeDays: number;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-zinc-500">
        No clicks recorded in this range yet.
      </div>
    );
  }

  const peak = Math.max(...data.map((point) => point.count));

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -18 }} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="#f1effa" />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#52525b" }}
            tickFormatter={formatSeriesLabel}
            minTickGap={rangeDays > 30 ? 34 : 16}
            interval="preserveStartEnd"
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "#52525b" }}
            width={42}
          />
          <Tooltip
            cursor={{ fill: "#f5f3ff" }}
            contentStyle={{
              borderRadius: 10,
              border: "1px solid #ede9fe",
              boxShadow: "0 10px 24px -12px rgba(76,29,149,.35)",
              fontSize: 12,
            }}
            labelStyle={{ color: "#3f3f46", fontWeight: 600 }}
            labelFormatter={(label) => formatSeriesLabel(String(label))}
            formatter={(value) => [`${formatNumber(Number(value))} clicks`, "Recorded clicks"]}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={rangeDays > 30 ? 10 : 18} isAnimationActive={false}>
            {data.map((point) => (
              <Cell key={point.date} fill={point.count === peak ? "#6d28d9" : "#a78bfa"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
