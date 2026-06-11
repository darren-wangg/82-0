-- AlterTable
ALTER TABLE "Lobby" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "creatorAnonId" TEXT;

-- AlterTable
ALTER TABLE "LobbyEntry" ADD COLUMN     "anonIdentityId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "LobbyEntry_lobbyCode_anonIdentityId_key" ON "LobbyEntry"("lobbyCode", "anonIdentityId");
