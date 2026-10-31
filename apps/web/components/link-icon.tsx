import {
  Archive,
  BookOpen,
  Briefcase,
  Code2,
  FileText,
  Globe2,
  Heart,
  Link2,
  Mail,
  Share2,
  Star,
  type LucideIcon,
} from "lucide-react";
import type { LinkIconId } from "@linkhub/shared";
import { BrandIcon, isBrandName } from "./brand-icons";
import { cn } from "@/lib/utils";

const ICONS: Partial<Record<LinkIconId, LucideIcon>> = {
  link: Link2,
  globe: Globe2,
  mail: Mail,
  file: FileText,
  code: Code2,
  share: Share2,
  briefcase: Briefcase,
  book: BookOpen,
  star: Star,
  heart: Heart,
  archive: Archive,
};

export function detectIcon(url: string): LinkIconId {
  if (url.startsWith("mailto:")) return "mail";
  const lower = url.toLowerCase();
  if (lower.includes("github.com")) return "github";
  if (lower.includes("linkedin.com")) return "linkedin";
  if (lower.includes("x.com") || lower.includes("twitter.com")) return "x";
  if (lower.includes("medium.com")) return "medium";
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) return "youtube";
  if (lower.includes("spotify.com") || lower.includes("spoti.fi")) return "spotify";
  if (lower.includes("instagram.com") || lower.includes("instagr.am")) return "instagram";
  return "globe";
}

export function resolveIcon(icon: LinkIconId, url: string): LinkIconId {
  return icon === "auto" ? detectIcon(url) : icon;
}

export function LinkIcon({
  icon,
  url,
  className,
  monochrome = false,
}: {
  icon: LinkIconId;
  url: string;
  className?: string;
  monochrome?: boolean;
}) {
  const resolved = resolveIcon(icon, url);
  if (isBrandName(resolved)) {
    return <BrandIcon name={resolved} className={cn("size-5", className)} monochrome={monochrome} />;
  }
  const Component = ICONS[resolved] ?? Globe2;
  return <Component aria-hidden="true" className={cn("size-5", className)} strokeWidth={1.9} />;
}
