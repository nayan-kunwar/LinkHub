-- Link blocks: `type` selects the renderer, `config` holds per-type settings.
-- Both columns are additive with defaults so existing rows keep working as
-- classic links while older API/web builds are still running.
ALTER TABLE "links" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'link';
ALTER TABLE "links" ADD COLUMN "config" JSONB NOT NULL DEFAULT '{}';
