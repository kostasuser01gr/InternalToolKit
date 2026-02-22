-- DropIndex
DROP INDEX "UserShortcut_workspaceId_userId_createdAt_idx";

-- AlterTable
ALTER TABLE "UserShortcut" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "UserShortcut_workspaceId_userId_position_idx" ON "UserShortcut"("workspaceId", "userId", "position");
