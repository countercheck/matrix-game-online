-- DropIndex
DROP INDEX IF EXISTS "game_players_persona_id_key";

-- AlterTable
ALTER TABLE "game_players" ADD COLUMN "is_persona_lead" BOOLEAN NOT NULL DEFAULT false;
