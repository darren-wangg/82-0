-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "isPreset" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mode" TEXT,
ADD COLUMN     "difficulty" TEXT;

-- CreateIndex
CREATE INDEX "Team_mode_difficulty_snapshotVersion_ovr_idx" ON "Team"("mode", "difficulty", "snapshotVersion", "ovr");
