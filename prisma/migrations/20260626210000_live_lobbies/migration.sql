-- AlterTable
ALTER TABLE "Lobby" ADD COLUMN     "isLive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "startedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LobbyParticipant" (
    "id" TEXT NOT NULL,
    "lobbyCode" TEXT NOT NULL,
    "anonIdentityId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "picksCount" INTEGER NOT NULL DEFAULT 0,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "teamSlug" TEXT,

    CONSTRAINT "LobbyParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LobbyParticipant_lobbyCode_idx" ON "LobbyParticipant"("lobbyCode");

-- CreateIndex
CREATE UNIQUE INDEX "LobbyParticipant_lobbyCode_anonIdentityId_key" ON "LobbyParticipant"("lobbyCode", "anonIdentityId");

-- AddForeignKey
ALTER TABLE "LobbyParticipant" ADD CONSTRAINT "LobbyParticipant_lobbyCode_fkey" FOREIGN KEY ("lobbyCode") REFERENCES "Lobby"("code") ON DELETE CASCADE ON UPDATE CASCADE;
