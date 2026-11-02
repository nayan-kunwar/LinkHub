import type { LinkIconId, LinkType } from "@linkhub/shared";

/** Editable block state shared by the dialog form and its live preview. */
export interface LinkDraft {
  type: LinkType;
  title: string;
  url: string;
  categoryId: string | null;
  description: string;
  icon: LinkIconId;
  isActive: boolean;
  config: Record<string, unknown>;
}
