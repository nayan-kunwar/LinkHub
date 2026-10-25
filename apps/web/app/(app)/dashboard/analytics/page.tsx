import type { Metadata } from "next";
import { Suspense } from "react";
import { AnalyticsFallback, AnalyticsView } from "./analytics-view";

export const metadata: Metadata = {
  title: "Analytics",
  description: "Track link performance, traffic sources, devices and countries.",
};

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<AnalyticsFallback />}>
      <AnalyticsView />
    </Suspense>
  );
}
