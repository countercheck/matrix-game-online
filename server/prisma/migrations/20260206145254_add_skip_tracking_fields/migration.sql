-- AlterTable
ALTER TABLE "actions" ADD COLUMN     "argumentation_was_skipped" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "voting_was_skipped" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "votes" ADD COLUMN     "was_skipped" BOOLEAN NOT NULL DEFAULT false;
