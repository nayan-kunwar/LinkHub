import type { Link as LinkRecord } from "@linkhub/shared";
import { toBlock } from "@linkhub/shared";
import { BlockContact } from "./block-contact";
import { BlockHeader } from "./block-header";
import { BlockLink } from "./block-link";
import { BlockYouTube } from "./block-youtube";
import type { BlockProps } from "./types";

export function BlockRenderer({
  link,
  ...props
}: { link: LinkRecord } & BlockProps) {
  const block = toBlock(link);
  if (!block) return null;

  switch (block.type) {
    case "link":
      return <BlockLink link={block.link} config={block.config} {...props} />;
    case "header":
      return <BlockHeader link={block.link} config={block.config} {...props} />;
    case "youtube":
      return <BlockYouTube link={block.link} config={block.config} {...props} />;
    case "contact":
      return <BlockContact link={block.link} config={block.config} {...props} />;
  }
}
