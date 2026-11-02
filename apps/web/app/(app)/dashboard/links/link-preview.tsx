"use client";

import { useEffect, useMemo, useRef } from "react";
import { AlertCircle } from "lucide-react";
import {
  contactConfigSchema,
  defaultConfigFor,
  EMPTY_LINK_METADATA,
  headerConfigSchema,
  linkConfigSchema,
  normalizeUrl,
  parseYouTubeId,
  youtubeConfigSchema,
  type Link as LinkRecord,
  type LinkMetadata,
} from "@linkhub/shared";
import { PhoneFrame } from "@/components/phone-frame";
import { ProfileView } from "@/components/profile-view";
import { useAppState } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { LinkDraft } from "./link-draft";

const DRAFT_ID = "link-draft-preview";

function configString(config: Record<string, unknown>, key: string): string {
  const value = config[key];
  return typeof value === "string" ? value : "";
}

function configBoolean(
  config: Record<string, unknown>,
  key: string,
  fallback: boolean,
): boolean {
  const value = config[key];
  return typeof value === "boolean" ? value : fallback;
}

function validHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      url.hostname.includes(".")
    );
  } catch {
    return false;
  }
}

/**
 * The form can hold partially typed values that the strict block schemas would
 * reject. Keep the preview useful by removing only the invalid bits instead of
 * dropping the whole block.
 */
function previewConfig(draft: LinkDraft): Record<string, unknown> {
  switch (draft.type) {
    case "link": {
      const imageUrl = configString(draft.config, "imageUrl").trim();
      const parsed = linkConfigSchema.safeParse({
        ...draft.config,
        imageUrl: validHttpsUrl(imageUrl) ? imageUrl : "",
      });
      return parsed.success ? parsed.data : defaultConfigFor("link");
    }
    case "header": {
      const parsed = headerConfigSchema.safeParse(draft.config);
      return parsed.success ? parsed.data : defaultConfigFor("header");
    }
    case "youtube": {
      const parsed = youtubeConfigSchema.safeParse({
        videoId: parseYouTubeId(draft.url) ?? "",
      });
      return parsed.success ? parsed.data : {};
    }
    case "contact": {
      const email = configString(draft.config, "email").trim();
      const phone = configString(draft.config, "phone").trim();
      const whatsapp = configString(draft.config, "whatsapp").trim();
      const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      const validPhone = /^\+?[0-9 ()-]{7,20}$/.test(phone);
      const validWhatsapp = /^\+?[0-9 ()-]{7,20}$/.test(whatsapp);
      const parsed = contactConfigSchema.safeParse({
        email: validEmail ? email : "",
        phone: validPhone ? phone : "",
        whatsapp: validWhatsapp ? whatsapp : "",
      });
      return parsed.success ? parsed.data : {};
    }
  }
}

export function LinkPreview({
  draft,
  link,
  metadata,
  view,
  className,
}: {
  draft: LinkDraft;
  link: LinkRecord | null;
  metadata: LinkMetadata | null;
  view?: "form" | "preview";
  className?: string;
}) {
  const state = useAppState();
  const containerRef = useRef<HTMLDivElement>(null);

  const config = useMemo(() => previewConfig(draft), [draft]);
  const canRenderDraft =
    draft.type === "link" ||
    draft.type === "header" ||
    (draft.type === "youtube" && Boolean(config.videoId)) ||
    (draft.type === "contact" && contactConfigSchema.safeParse(config).success);

  const hiddenCategory = draft.categoryId
    ? state.categories.find(
        (category) => category.id === draft.categoryId && !category.isVisible,
      )
    : undefined;

  const activeMetadata =
    metadata && metadata.sourceUrl === normalizeUrl(draft.url) ? metadata : null;
  const usePreviewImage = configBoolean(draft.config, "usePreviewImage", true);
  const fallbackPreviewImageUrl =
    link && normalizeUrl(link.url) === normalizeUrl(draft.url)
      ? link.previewImageUrl
      : "";
  const maxSortOrder = state.links.reduce(
    (highest, item) => Math.max(highest, item.sortOrder),
    0,
  );

  const blockVisualKey = [
    draft.type,
    configString(draft.config, "layout"),
    configString(draft.config, "imageUrl"),
    usePreviewImage ? "preview" : "no-preview",
  ].join(":");

  const previewLinkId = link?.id ?? DRAFT_ID;
  const draftLink = useMemo<LinkRecord>(
    () => ({
      id: previewLinkId,
      title:
        draft.title.trim() ||
        (draft.type === "contact" ? "" : "Untitled block"),
      url: draft.url,
      type: draft.type,
      config,
      metadata: activeMetadata ?? EMPTY_LINK_METADATA,
      previewImageUrl: usePreviewImage
        ? activeMetadata?.imageUrl || fallbackPreviewImageUrl
        : "",
      description: draft.description,
      categoryId: draft.categoryId,
      icon: draft.icon,
      isActive: true,
      sortOrder: link?.sortOrder ?? maxSortOrder + 1,
      createdAt: link?.createdAt ?? new Date(0).toISOString(),
    }),
    [
      activeMetadata,
      config,
      draft.categoryId,
      draft.description,
      draft.icon,
      draft.title,
      draft.type,
      draft.url,
      fallbackPreviewImageUrl,
      link,
      maxSortOrder,
      previewLinkId,
      usePreviewImage,
    ],
  );

  // A hidden category would normally remove the whole draft from the page.
  // Show the draft in place anyway, but keep the rest of that category hidden
  // so the preview does not imply that its siblings are public too.
  const baseLinks =
    canRenderDraft && hiddenCategory
      ? state.links.filter(
          (item) =>
            item.categoryId !== hiddenCategory.id || item.id === link?.id,
        )
      : state.links;
  const previewLinks = canRenderDraft
    ? link
      ? baseLinks.map((item) => (item.id === link.id ? draftLink : item))
      : [...baseLinks, draftLink]
    : state.links;

  const previewCategories =
    canRenderDraft && hiddenCategory
      ? state.categories.map((category) =>
          category.id === hiddenCategory.id
            ? { ...category, isVisible: true }
            : category,
        )
      : state.categories;

  useEffect(() => {
    const root = containerRef.current;
    const scroller = root?.querySelector<HTMLElement>("[data-phone-scroll]");
    const target = root?.querySelector<HTMLElement>(
      `[data-link-id="${previewLinkId}"]`,
    );
    if (!root || !scroller || !target) return;

    const targetRect = target.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();
    const fullyVisible =
      targetRect.top >= scrollerRect.top &&
      targetRect.bottom <= scrollerRect.bottom;
    if (fullyVisible) return;

    const top = targetRect.top - scrollerRect.top + scroller.scrollTop;
    scroller.scrollTo({ top: Math.max(top - 16, 0), behavior: "smooth" });
  }, [
    blockVisualKey,
    canRenderDraft,
    draft.categoryId,
    draft.isActive,
    draft.type,
    draftLink.previewImageUrl,
    previewLinkId,
    view,
  ]);

  const notices: string[] = [];
  if (!draft.isActive && canRenderDraft) {
    notices.push("Inactive — this block stays off your public profile.");
  }
  if (hiddenCategory && canRenderDraft) {
    notices.push(
      `“${hiddenCategory.name}” is hidden, so this block stays off your public profile.`,
    );
  }

  const emptyMessage =
    draft.type === "youtube"
      ? "Paste a valid YouTube link to see this block in the preview."
      : draft.type === "contact"
        ? "Add an email, phone or WhatsApp number to see this contact block."
        : "";

  return (
    <div
      ref={containerRef}
      data-testid="link-live-preview"
      data-preview-layout={
        draft.type === "link" ? configString(draft.config, "layout") || "classic" : undefined
      }
      className={cn("space-y-3", className)}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-zinc-900">Live preview</h3>
          <p className="text-xs text-zinc-500">Updates as you edit.</p>
        </div>
        <span className="rounded-full bg-violet-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-800">
          Draft
        </span>
      </div>

      {notices.length > 0 ? (
        <ul className="space-y-1.5">
          {notices.map((notice) => (
            <li
              key={notice}
              className="flex gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900"
            >
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              <span>{notice}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {!canRenderDraft ? (
        <p className="rounded-lg border border-dashed border-zinc-300 bg-white px-3 py-2 text-center text-xs text-zinc-500">
          {emptyMessage}
        </p>
      ) : null}

      <div aria-hidden="true" inert className="pointer-events-none select-none">
        <PhoneFrame
          className="max-w-full"
          screenClassName="h-[440px] max-h-[calc(90vh_-_250px)]"
        >
          <ProfileView
            profile={state.profile}
            categories={previewCategories}
            links={previewLinks}
            appearance={state.appearance}
            variant="phone"
          />
        </PhoneFrame>
      </div>
    </div>
  );
}
