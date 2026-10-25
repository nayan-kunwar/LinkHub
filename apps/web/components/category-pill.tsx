import type { Category } from "@linkhub/shared";
import { cn, hexToRgba, shadeHex } from "@/lib/utils";

export function CategoryPill({
  category,
  className,
}: {
  category: Category | null;
  className?: string;
}) {
  if (!category) {
    return (
      <span className={cn("inline-flex rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-700", className)}>
        Uncategorized
      </span>
    );
  }

  return (
    <span
      className={cn("inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold", className)}
      style={{
        backgroundColor: hexToRgba(category.color, 0.11),
        color: shadeHex(category.color, 0.6),
      }}
    >
      {category.name}
    </span>
  );
}
