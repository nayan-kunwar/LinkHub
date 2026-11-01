-- Server-owned Open Graph/Twitter preview metadata. Existing rows get an empty object.
ALTER TABLE "links" ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}';
