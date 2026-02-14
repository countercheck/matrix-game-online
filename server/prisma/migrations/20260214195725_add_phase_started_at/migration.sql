-- AlterTable
ALTER TABLE "games" ADD COLUMN     "phase_started_at" TIMESTAMP(3);

-- Backfill phase_started_at for existing ACTIVE games so timeouts keep working
UPDATE "games"
SET "phase_started_at" = NOW()
WHERE "phase_started_at" IS NULL
  AND "status" = 'ACTIVE';
