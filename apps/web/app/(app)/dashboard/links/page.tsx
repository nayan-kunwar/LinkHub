import type { Metadata } from "next";
import { Suspense } from "react";
import { LinksFallback, LinksView } from "./links-view";

export const metadata: Metadata = {
  title: "Links",
  description: "Add, organize and reorder the links on your public Link Hub profile.",
};

export default function LinksPage() {
  return (
    <Suspense fallback={<LinksFallback />}>
      <LinksView />
    </Suspense>
  );
}
