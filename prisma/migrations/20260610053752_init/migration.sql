-- CreateTable
CREATE TABLE "Player" (
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nickname" TEXT,
    "nbaPlayerId" INTEGER,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "PlayerSeason" (
    "id" TEXT NOT NULL,
    "playerSlug" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "decade" TEXT NOT NULL,
    "peakSeason" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "altPositions" TEXT[],
    "pts" DOUBLE PRECISION NOT NULL,
    "reb" DOUBLE PRECISION NOT NULL,
    "ast" DOUBLE PRECISION NOT NULL,
    "stl" DOUBLE PRECISION NOT NULL,
    "blk" DOUBLE PRECISION NOT NULL,
    "fgPct" DOUBLE PRECISION NOT NULL,
    "ftPct" DOUBLE PRECISION NOT NULL,
    "tpm" DOUBLE PRECISION NOT NULL,
    "tov" DOUBLE PRECISION NOT NULL,
    "ortg" DOUBLE PRECISION NOT NULL,
    "drtg" DOUBLE PRECISION NOT NULL,
    "estimatedCats" TEXT[],

    CONSTRAINT "PlayerSeason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "displayName" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "AnonIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnonIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "slug" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "roster" JSONB NOT NULL,
    "snapshotVersion" TEXT NOT NULL,
    "ovr" DOUBLE PRECISION NOT NULL,
    "offRating" DOUBLE PRECISION NOT NULL,
    "defRating" DOUBLE PRECISION NOT NULL,
    "catProfile" JSONB NOT NULL,
    "wins" INTEGER NOT NULL,
    "losses" INTEGER NOT NULL,
    "gatedCategory" TEXT,
    "anonIdentityId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "Matchup" (
    "id" TEXT NOT NULL,
    "teamASlug" TEXT NOT NULL,
    "teamBSlug" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Matchup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lobby" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lobby_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "LobbyEntry" (
    "id" TEXT NOT NULL,
    "lobbyCode" TEXT NOT NULL,
    "teamSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LobbyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Explanation" (
    "contentHash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Explanation_pkey" PRIMARY KEY ("contentHash")
);

-- CreateIndex
CREATE INDEX "PlayerSeason_franchiseId_decade_idx" ON "PlayerSeason"("franchiseId", "decade");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_displayName_key" ON "User"("displayName");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Team_snapshotVersion_wins_ovr_idx" ON "Team"("snapshotVersion", "wins", "ovr");

-- CreateIndex
CREATE INDEX "Team_createdAt_idx" ON "Team"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Matchup_teamASlug_teamBSlug_seed_key" ON "Matchup"("teamASlug", "teamBSlug", "seed");

-- CreateIndex
CREATE UNIQUE INDEX "LobbyEntry_lobbyCode_teamSlug_key" ON "LobbyEntry"("lobbyCode", "teamSlug");

-- AddForeignKey
ALTER TABLE "PlayerSeason" ADD CONSTRAINT "PlayerSeason_playerSlug_fkey" FOREIGN KEY ("playerSlug") REFERENCES "Player"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnonIdentity" ADD CONSTRAINT "AnonIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_anonIdentityId_fkey" FOREIGN KEY ("anonIdentityId") REFERENCES "AnonIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matchup" ADD CONSTRAINT "Matchup_teamASlug_fkey" FOREIGN KEY ("teamASlug") REFERENCES "Team"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matchup" ADD CONSTRAINT "Matchup_teamBSlug_fkey" FOREIGN KEY ("teamBSlug") REFERENCES "Team"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LobbyEntry" ADD CONSTRAINT "LobbyEntry_lobbyCode_fkey" FOREIGN KEY ("lobbyCode") REFERENCES "Lobby"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LobbyEntry" ADD CONSTRAINT "LobbyEntry_teamSlug_fkey" FOREIGN KEY ("teamSlug") REFERENCES "Team"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;
