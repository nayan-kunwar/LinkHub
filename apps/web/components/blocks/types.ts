import type { Link as LinkRecord } from "@linkhub/shared";

export interface BlockProps {
  isPage: boolean;
  dark: boolean;
  brand: boolean;
  showDescription: boolean;
  onLinkClick?: (link: LinkRecord) => void;
}
