-- AlterTable
ALTER TABLE "games" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "games_deleted_at_idx" ON "games"("deleted_at");
