import type { Metadata } from "next";
import { ExportView } from "./export-view";

export const metadata: Metadata = {
  title: "Export",
  description: "Download your Link Hub profile, links, categories and analytics.",
};

export default function ExportPage() {
  return <ExportView />;
}
