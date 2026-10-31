import { Mail, MessageCircle, Phone, type LucideIcon } from "lucide-react";
import type { Link, LinkConfigMap } from "@linkhub/shared";
import { cn } from "@/lib/utils";
import type { BlockProps } from "./types";

export function BlockContact({
  link,
  config,
  isPage,
  onLinkClick,
}: { link: Link; config: LinkConfigMap["contact"] } & BlockProps) {
  const rows: Array<{ href: string; label: string; icon: LucideIcon; external: boolean }> = [];
  if (config.email) {
    rows.push({
      href: `mailto:${config.email}`,
      label: config.email,
      icon: Mail,
      external: false,
    });
  }
  if (config.phone) {
    rows.push({
      href: `tel:${config.phone.replace(/[^\d+]/g, "")}`,
      label: config.phone,
      icon: Phone,
      external: false,
    });
  }
  if (config.whatsapp) {
    rows.push({
      href: `https://wa.me/${config.whatsapp.replace(/\D/g, "")}`,
      label: "WhatsApp",
      icon: MessageCircle,
      external: true,
    });
  }

  return (
    <div className="space-y-2">
      {link.title ? (
        <p
          className={cn(
            "text-center font-bold",
            isPage ? "text-base" : "text-xs",
          )}
          style={{ color: "var(--lh-text)" }}
        >
          {link.title}
        </p>
      ) : null}
      {rows.map((row) => (
        <a
          key={row.href}
          href={row.href}
          target={row.external ? "_blank" : undefined}
          rel={row.external ? "noopener noreferrer" : undefined}
          onClick={() => onLinkClick?.(link)}
          className={cn(
            "lh-card flex items-center justify-center gap-2 font-semibold transition hover:-translate-y-0.5 hover:brightness-[1.02] focus-visible:ring-4 focus-visible:ring-violet-300",
            isPage ? "px-4 py-3 text-sm" : "px-3 py-2 text-xs",
          )}
        >
          <row.icon aria-hidden="true" className={cn("shrink-0", isPage ? "size-4" : "size-3.5")} />
          <span className="truncate">{row.label}</span>
        </a>
      ))}
    </div>
  );
}
