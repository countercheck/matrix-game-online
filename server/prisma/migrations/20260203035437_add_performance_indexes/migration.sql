-- CreateIndex
CREATE INDEX "actions_round_id_initiator_id_idx" ON "actions"("round_id", "initiator_id");

-- CreateIndex
CREATE INDEX "arguments_action_id_player_id_idx" ON "arguments"("action_id", "player_id");

-- CreateIndex
CREATE INDEX "game_players_user_id_is_active_idx" ON "game_players"("user_id", "is_active");
