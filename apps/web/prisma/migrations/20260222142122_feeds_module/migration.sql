-- CreateEnum
CREATE TYPE "FeedCategory" AS ENUM ('BOOKING_POLICY', 'COMPETITOR_NEWS', 'SALES_OPPORTUNITY', 'SECURITY_ALERT', 'GENERAL');

-- CreateTable
CREATE TABLE "FeedSource" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'rss',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "scanIntervalMin" INTEGER NOT NULL DEFAULT 30,
    "lastScannedAt" TIMESTAMP(3),
    "lastEtag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedItem" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "url" TEXT NOT NULL,
    "urlHash" TEXT NOT NULL,
    "category" "FeedCategory" NOT NULL DEFAULT 'GENERAL',
    "relevanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "keywords" TEXT,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "pinnedBy" TEXT,
    "sharedToChannelId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedSource_workspaceId_idx" ON "FeedSource"("workspaceId");

-- CreateIndex
CREATE INDEX "FeedItem_workspaceId_category_idx" ON "FeedItem"("workspaceId", "category");

-- CreateIndex
CREATE INDEX "FeedItem_workspaceId_fetchedAt_idx" ON "FeedItem"("workspaceId", "fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeedItem_workspaceId_urlHash_key" ON "FeedItem"("workspaceId", "urlHash");

-- AddForeignKey
ALTER TABLE "FeedSource" ADD CONSTRAINT "FeedSource_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedItem" ADD CONSTRAINT "FeedItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedItem" ADD CONSTRAINT "FeedItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "FeedSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
