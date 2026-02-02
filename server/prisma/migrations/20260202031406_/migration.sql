/*
  Warnings:

  - A unique constraint covering the columns `[persona_id]` on the table `game_players` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "game_players" ADD COLUMN     "persona_id" TEXT;

-- CreateTable
CREATE TABLE "personas" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "argumentation_complete" (
    "id" TEXT NOT NULL,
    "action_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "argumentation_complete_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "personas_game_id_idx" ON "personas"("game_id");

-- CreateIndex
CREATE UNIQUE INDEX "personas_game_id_name_key" ON "personas"("game_id", "name");

-- CreateIndex
CREATE INDEX "argumentation_complete_action_id_idx" ON "argumentation_complete"("action_id");

-- CreateIndex
CREATE UNIQUE INDEX "argumentation_complete_action_id_player_id_key" ON "argumentation_complete"("action_id", "player_id");

-- CreateIndex
CREATE UNIQUE INDEX "game_players_persona_id_key" ON "game_players"("persona_id");

-- AddForeignKey
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "personas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personas" ADD CONSTRAINT "personas_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "argumentation_complete" ADD CONSTRAINT "argumentation_complete_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "argumentation_complete" ADD CONSTRAINT "argumentation_complete_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "game_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
