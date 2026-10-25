import { z } from "zod";

export const rangeSchema = z.enum(["7d", "30d", "90d", "365d"]).default("30d");

export const overviewQuerySchema = z.object({
  range: rangeSchema,
  linkId: z.uuid().optional(),
});

export const timeseriesQuerySchema = z.object({
  range: rangeSchema,
  linkId: z.uuid().optional(),
});

export const breakdownQuerySchema = z.object({
  range: rangeSchema,
  linkId: z.uuid().optional(),
  dimension: z.enum(["country", "device", "referrer"]),
});
