-- AlterTable
ALTER TABLE "game_players" ADD COLUMN     "is_npc" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "personas" ADD COLUMN     "is_npc" BOOLEAN NOT NULL DEFAULT false;
