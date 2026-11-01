import { Globe2, Mail } from "lucide-react";
import { isMailtoUrl, type SocialLinks } from "@linkhub/shared";
import { BrandIcon, isBrandName, type BrandName } from "./brand-icons";
import { cn } from "@/lib/utils";

const ORDER: Array<keyof SocialLinks> = ["website", "github", "linkedin", "x", "medium", "email"];

const LABELS: Record<keyof SocialLinks, string> = {
  website: "Website",
  github: "GitHub",
  linkedin: "LinkedIn",
  x: "X",
  medium: "Medium",
  email: "Email",
};

export function SocialIcons({
  socials,
  className,
  monochrome = false,
  iconClassName,
}: {
  socials: SocialLinks;
  className?: string;
  monochrome?: boolean;
  iconClassName?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-3", className)}>
      {ORDER.map((key) => {
        const href = socials[key];
        if (!href) return null;
        const label = LABELS[key];
        return (
          <a
            key={key}
            href={href}
            target={isMailtoUrl(href) ? undefined : "_blank"}
            rel={isMailtoUrl(href) ? undefined : "noopener noreferrer"}
            aria-label={label}
            title={label}
            className={cn(
              "rounded-md p-0.5 transition hover:-translate-y-0.5 hover:opacity-80 focus-visible:ring-4 focus-visible:ring-violet-200",
              monochrome ? "text-current" : "text-violet-700",
            )}
          >
            {isBrandName(key) ? (
              <BrandIcon name={key as BrandName} className={cn("size-4", iconClassName)} monochrome={monochrome} />
            ) : key === "website" ? (
              <Globe2 aria-hidden="true" className={cn("size-4", iconClassName)} strokeWidth={2} />
            ) : (
              <Mail aria-hidden="true" className={cn("size-4", iconClassName)} strokeWidth={2} />
            )}
          </a>
        );
      })}
    </div>
  );
}
