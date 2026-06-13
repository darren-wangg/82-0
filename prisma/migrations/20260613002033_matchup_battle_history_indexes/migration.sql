-- CreateIndex
CREATE INDEX "Matchup_teamASlug_createdAt_idx" ON "Matchup"("teamASlug", "createdAt");

-- CreateIndex
CREATE INDEX "Matchup_teamBSlug_createdAt_idx" ON "Matchup"("teamBSlug", "createdAt");
