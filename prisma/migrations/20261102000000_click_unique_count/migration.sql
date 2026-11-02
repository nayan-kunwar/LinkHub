-- Nullable so days rolled up before unique-click tracking remain "not tracked"
-- rather than a fabricated zero. New rows are written once by the nightly job.
ALTER TABLE "click_daily_stats" ADD COLUMN "unique_count" INTEGER;
