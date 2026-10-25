import { z } from "zod";

export const clickSchema = z.object({
  linkId: z.uuid(),
  referrer: z.string().max(2048).optional(),
});

export type ClickInput = z.infer<typeof clickSchema>;
