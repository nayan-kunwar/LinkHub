-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('owner', 'admin', 'user');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('pending_verification', 'active', 'suspended', 'deleted');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('free');

-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('email_verification', 'password_reset', 'email_change', 'account_restore');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "pending_email" CITEXT,
    "password_hash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'user',
    "status" "UserStatus" NOT NULL DEFAULT 'pending_verification',
    "plan" "Plan" NOT NULL DEFAULT 'free',
    "email_verified_at" TIMESTAMPTZ,
    "deletion_scheduled_for" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "sid" VARCHAR(255) NOT NULL,
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("sid")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "TokenType" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "username" CITEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "headline" TEXT,
    "bio" TEXT,
    "avatar_url" TEXT,
    "socials" JSONB NOT NULL DEFAULT '{}',
    "theme" JSONB NOT NULL DEFAULT '{}',
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#7c3aed',
    "icon" TEXT NOT NULL DEFAULT 'folder',
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "links" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "category_id" UUID,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT NOT NULL DEFAULT 'auto',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "click_events" (
    "id" UUID NOT NULL,
    "link_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "clicked_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referrer_host" TEXT,
    "device_type" TEXT,
    "country_code" VARCHAR(2),
    "visitor_hash" TEXT,

    CONSTRAINT "click_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_state" (
    "name" TEXT NOT NULL,
    "watermark" DATE NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "job_state_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "click_daily_stats" (
    "link_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "click_daily_stats_pkey" PRIMARY KEY ("link_id","day")
);

-- CreateTable
CREATE TABLE "click_daily_breakdowns" (
    "link_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "dimension" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "click_daily_breakdowns_pkey" PRIMARY KEY ("link_id","day","dimension","value")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE INDEX "sessions_expire_idx" ON "sessions"("expire");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_hash_key" ON "verification_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "verification_tokens_user_id_type_idx" ON "verification_tokens"("user_id", "type");

-- CreateIndex
CREATE INDEX "verification_tokens_expires_at_idx" ON "verification_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_user_id_key" ON "profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_username_key" ON "profiles"("username");

-- CreateIndex
CREATE INDEX "categories_user_id_sort_order_idx" ON "categories"("user_id", "sort_order");

-- CreateIndex
CREATE INDEX "categories_user_id_deleted_at_idx" ON "categories"("user_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "categories_id_user_id_key" ON "categories"("id", "user_id");

-- CreateIndex
CREATE INDEX "links_user_id_sort_order_idx" ON "links"("user_id", "sort_order");

-- CreateIndex
CREATE INDEX "links_user_id_category_id_idx" ON "links"("user_id", "category_id");

-- CreateIndex
CREATE INDEX "links_user_id_deleted_at_idx" ON "links"("user_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "links_id_user_id_key" ON "links"("id", "user_id");

-- CreateIndex
CREATE INDEX "click_events_link_id_clicked_at_idx" ON "click_events"("link_id", "clicked_at");

-- CreateIndex
CREATE INDEX "click_events_user_id_clicked_at_idx" ON "click_events"("user_id", "clicked_at");

-- CreateIndex
CREATE INDEX "click_events_clicked_at_idx" ON "click_events"("clicked_at");

-- CreateIndex
CREATE INDEX "click_daily_stats_user_id_day_idx" ON "click_daily_stats"("user_id", "day");

-- CreateIndex
CREATE INDEX "click_daily_breakdowns_user_id_day_dimension_idx" ON "click_daily_breakdowns"("user_id", "day", "dimension");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "links" ADD CONSTRAINT "links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "links" ADD CONSTRAINT "links_category_id_user_id_fkey" FOREIGN KEY ("category_id", "user_id") REFERENCES "categories"("id", "user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_link_id_user_id_fkey" FOREIGN KEY ("link_id", "user_id") REFERENCES "links"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "click_daily_stats" ADD CONSTRAINT "click_daily_stats_link_id_user_id_fkey" FOREIGN KEY ("link_id", "user_id") REFERENCES "links"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "click_daily_stats" ADD CONSTRAINT "click_daily_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "click_daily_breakdowns" ADD CONSTRAINT "click_daily_breakdowns_link_id_user_id_fkey" FOREIGN KEY ("link_id", "user_id") REFERENCES "links"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "click_daily_breakdowns" ADD CONSTRAINT "click_daily_breakdowns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Hand-written v2.4 constraints and indexes (Prisma cannot express these).
-- ---------------------------------------------------------------------------

-- "Log out everywhere" / account purge lookups by session user.
CREATE INDEX "sessions_user_id_expr_idx" ON "sessions" ((sess->>'userId'));

-- Prevent two accounts claiming the same pending email. The service still
-- returns a generic response to avoid account enumeration.
CREATE UNIQUE INDEX "users_pending_email_unique" ON "users"("pending_email")
  WHERE "pending_email" IS NOT NULL;

-- Nightly purge scan for accounts past their deletion grace period.
CREATE INDEX "users_deletion_scheduled_for_idx" ON "users"("deletion_scheduled_for")
  WHERE "deletion_scheduled_for" IS NOT NULL;

-- Hash-clearing scan keeps only rows that still carry a dedupe hash.
CREATE INDEX "click_events_visitor_hash_clicked_at_idx" ON "click_events"("clicked_at")
  WHERE "visitor_hash" IS NOT NULL;

-- Soft-delete scans.
CREATE INDEX "links_active_user_sort_order_idx" ON "links"("user_id", "sort_order")
  WHERE "deleted_at" IS NULL;
CREATE INDEX "links_active_user_category_id_idx" ON "links"("user_id", "category_id")
  WHERE "deleted_at" IS NULL;
CREATE INDEX "categories_active_user_sort_order_idx" ON "categories"("user_id", "sort_order")
  WHERE "deleted_at" IS NULL;
CREATE INDEX "users_active_id_idx" ON "users"("id") WHERE "deleted_at" IS NULL;

-- Usernames are stored lowercase even though the column is citext.
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_username_format_check"
  CHECK ("username" = lower("username") AND "username" ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$');
