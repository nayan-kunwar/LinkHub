"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ShareButton({
  url,
  title,
  isPage,
}: {
  url: string;
  title: string;
  isPage: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Profile link copied");
    window.setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await copy();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      try {
        await copy();
      } catch {
        toast.error("Could not share this page.");
      }
    }
  };

  return (
    <button
      type="button"
      onClick={() => {
        void share();
      }}
      className={cn(
        "lh-card inline-flex items-center justify-center gap-2 font-semibold transition hover:-translate-y-0.5 hover:brightness-[1.02] focus-visible:ring-4 focus-visible:ring-violet-300",
        isPage ? "px-5 py-2 text-sm" : "px-3 py-1.5 text-[11px]",
      )}
    >
      {copied ? (
        <Check aria-hidden="true" className={isPage ? "size-4" : "size-3.5"} />
      ) : (
        <Share2 aria-hidden="true" className={isPage ? "size-4" : "size-3.5"} />
      )}
      {copied ? "Copied" : "Share"}
    </button>
  );
}
