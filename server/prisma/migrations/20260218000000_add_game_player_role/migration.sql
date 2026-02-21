-- CreateEnum
CREATE TYPE "GamePlayerRole" AS ENUM ('PLAYER', 'ARBITER');

-- AlterEnum
ALTER TYPE "GamePhase" ADD VALUE 'ARBITER_REVIEW';

-- AlterTable
ALTER TABLE "game_players" ADD COLUMN "game_role" "GamePlayerRole" NOT NULL DEFAULT 'PLAYER';

-- AlterTable
ALTER TABLE "arguments" ADD COLUMN "is_strong" BOOLEAN NOT NULL DEFAULT false;
