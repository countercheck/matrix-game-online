-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('LOBBY', 'ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "GamePhase" AS ENUM ('WAITING', 'PROPOSAL', 'ARGUMENTATION', 'VOTING', 'RESOLUTION', 'NARRATION', 'ROUND_SUMMARY');

-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('PROPOSED', 'ARGUING', 'VOTING', 'RESOLVED', 'NARRATED');

-- CreateEnum
CREATE TYPE "ArgumentType" AS ENUM ('INITIATOR_FOR', 'FOR', 'AGAINST', 'CLARIFICATION');

-- CreateEnum
CREATE TYPE "VoteType" AS ENUM ('LIKELY_SUCCESS', 'LIKELY_FAILURE', 'UNCERTAIN');

-- CreateEnum
CREATE TYPE "ResultType" AS ENUM ('TRIUMPH', 'SUCCESS_BUT', 'FAILURE_BUT', 'DISASTER');

-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" VARCHAR(50) NOT NULL,
    "avatar_url" VARCHAR(500),
    "notification_preferences" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_login" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "creator_id" TEXT NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'LOBBY',
    "current_phase" "GamePhase" NOT NULL DEFAULT 'WAITING',
    "current_round_id" TEXT,
    "current_action_id" TEXT,
    "player_count" INTEGER NOT NULL DEFAULT 0,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rounds" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "round_number" INTEGER NOT NULL,
    "status" "RoundStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "actions_completed" INTEGER NOT NULL DEFAULT 0,
    "total_actions_required" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "round_summaries" (
    "id" TEXT NOT NULL,
    "round_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "outcomes" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "round_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_players" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "player_name" VARCHAR(50) NOT NULL,
    "join_order" INTEGER NOT NULL,
    "is_host" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3),

    CONSTRAINT "game_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actions" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "round_id" TEXT NOT NULL,
    "initiator_id" TEXT NOT NULL,
    "sequence_number" INTEGER NOT NULL,
    "action_description" TEXT NOT NULL,
    "desired_outcome" TEXT NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'PROPOSED',
    "proposed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "argumentation_started_at" TIMESTAMP(3),
    "voting_started_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arguments" (
    "id" TEXT NOT NULL,
    "action_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "argument_type" "ArgumentType" NOT NULL,
    "content" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arguments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "votes" (
    "id" TEXT NOT NULL,
    "action_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "vote_type" "VoteType" NOT NULL,
    "success_tokens" INTEGER NOT NULL,
    "failure_tokens" INTEGER NOT NULL,
    "cast_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_draws" (
    "id" TEXT NOT NULL,
    "action_id" TEXT NOT NULL,
    "total_success_tokens" INTEGER NOT NULL,
    "total_failure_tokens" INTEGER NOT NULL,
    "random_seed" VARCHAR(255) NOT NULL,
    "drawn_success" INTEGER NOT NULL,
    "drawn_failure" INTEGER NOT NULL,
    "result_value" INTEGER NOT NULL,
    "result_type" "ResultType" NOT NULL,
    "drawn_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_draws_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drawn_tokens" (
    "id" TEXT NOT NULL,
    "token_draw_id" TEXT NOT NULL,
    "draw_sequence" INTEGER NOT NULL,
    "token_type" "TokenType" NOT NULL,

    CONSTRAINT "drawn_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "narrations" (
    "id" TEXT NOT NULL,
    "action_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "narrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_events" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "user_id" TEXT,
    "event_type" VARCHAR(50) NOT NULL,
    "event_data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "games_current_round_id_key" ON "games"("current_round_id");

-- CreateIndex
CREATE UNIQUE INDEX "games_current_action_id_key" ON "games"("current_action_id");

-- CreateIndex
CREATE INDEX "games_creator_id_idx" ON "games"("creator_id");

-- CreateIndex
CREATE INDEX "games_status_current_phase_idx" ON "games"("status", "current_phase");

-- CreateIndex
CREATE INDEX "games_created_at_idx" ON "games"("created_at");

-- CreateIndex
CREATE INDEX "rounds_game_id_status_idx" ON "rounds"("game_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "rounds_game_id_round_number_key" ON "rounds"("game_id", "round_number");

-- CreateIndex
CREATE UNIQUE INDEX "round_summaries_round_id_key" ON "round_summaries"("round_id");

-- CreateIndex
CREATE INDEX "round_summaries_author_id_idx" ON "round_summaries"("author_id");

-- CreateIndex
CREATE INDEX "game_players_game_id_is_active_idx" ON "game_players"("game_id", "is_active");

-- CreateIndex
CREATE INDEX "game_players_user_id_idx" ON "game_players"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "game_players_game_id_user_id_key" ON "game_players"("game_id", "user_id");

-- CreateIndex
CREATE INDEX "actions_game_id_status_idx" ON "actions"("game_id", "status");

-- CreateIndex
CREATE INDEX "actions_round_id_status_idx" ON "actions"("round_id", "status");

-- CreateIndex
CREATE INDEX "actions_initiator_id_idx" ON "actions"("initiator_id");

-- CreateIndex
CREATE UNIQUE INDEX "actions_game_id_sequence_number_key" ON "actions"("game_id", "sequence_number");

-- CreateIndex
CREATE INDEX "arguments_action_id_sequence_idx" ON "arguments"("action_id", "sequence");

-- CreateIndex
CREATE INDEX "arguments_player_id_idx" ON "arguments"("player_id");

-- CreateIndex
CREATE INDEX "votes_action_id_idx" ON "votes"("action_id");

-- CreateIndex
CREATE UNIQUE INDEX "votes_action_id_player_id_key" ON "votes"("action_id", "player_id");

-- CreateIndex
CREATE UNIQUE INDEX "token_draws_action_id_key" ON "token_draws"("action_id");

-- CreateIndex
CREATE INDEX "drawn_tokens_token_draw_id_draw_sequence_idx" ON "drawn_tokens"("token_draw_id", "draw_sequence");

-- CreateIndex
CREATE UNIQUE INDEX "narrations_action_id_key" ON "narrations"("action_id");

-- CreateIndex
CREATE INDEX "narrations_author_id_idx" ON "narrations"("author_id");

-- CreateIndex
CREATE INDEX "game_events_game_id_created_at_idx" ON "game_events"("game_id", "created_at");

-- CreateIndex
CREATE INDEX "game_events_event_type_idx" ON "game_events"("event_type");

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_current_round_id_fkey" FOREIGN KEY ("current_round_id") REFERENCES "rounds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_current_action_id_fkey" FOREIGN KEY ("current_action_id") REFERENCES "actions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "round_summaries" ADD CONSTRAINT "round_summaries_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "round_summaries" ADD CONSTRAINT "round_summaries_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "game_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_initiator_id_fkey" FOREIGN KEY ("initiator_id") REFERENCES "game_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arguments" ADD CONSTRAINT "arguments_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arguments" ADD CONSTRAINT "arguments_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "game_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "game_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_draws" ADD CONSTRAINT "token_draws_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drawn_tokens" ADD CONSTRAINT "drawn_tokens_token_draw_id_fkey" FOREIGN KEY ("token_draw_id") REFERENCES "token_draws"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "narrations" ADD CONSTRAINT "narrations_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "narrations" ADD CONSTRAINT "narrations_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "game_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
