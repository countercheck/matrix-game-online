-- AlterTable
ALTER TABLE "games" ADD COLUMN     "npc_momentum" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "personas" ADD COLUMN     "npc_action_description" TEXT,
ADD COLUMN     "npc_desired_outcome" TEXT;
