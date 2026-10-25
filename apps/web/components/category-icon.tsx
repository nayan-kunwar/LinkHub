import {
  Archive,
  BookOpen,
  Briefcase,
  Camera,
  Code2,
  Coffee,
  Folder,
  Globe2,
  Heart,
  Link2,
  Mail,
  Music2,
  Palette,
  Share2,
  Sparkles,
  Star,
  type LucideIcon,
} from "lucide-react";
import type { CategoryIconId } from "@linkhub/shared";
import { cn } from "@/lib/utils";

const ICONS: Record<CategoryIconId, LucideIcon> = {
  folder: Folder,
  share: Share2,
  code: Code2,
  briefcase: Briefcase,
  book: BookOpen,
  mail: Mail,
  archive: Archive,
  globe: Globe2,
  star: Star,
  heart: Heart,
  link: Link2,
  palette: Palette,
  music: Music2,
  camera: Camera,
  coffee: Coffee,
  sparkles: Sparkles,
};

export function CategoryIcon({
  icon,
  className,
}: {
  icon: CategoryIconId;
  className?: string;
}) {
  const Component = ICONS[icon] ?? Folder;
  return <Component aria-hidden="true" className={cn("size-5", className)} strokeWidth={1.9} />;
}
