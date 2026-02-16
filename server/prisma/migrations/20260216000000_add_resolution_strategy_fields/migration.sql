-- AlterTable
ALTER TABLE "actions" ADD COLUMN "resolution_method" VARCHAR(50),
ADD COLUMN "resolution_data" JSONB;
