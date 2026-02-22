-- CreateTable
CREATE TABLE "CronRun" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "job" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'running',
    "itemsProcessed" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CronRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeadLetterEntry" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "error" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "lastAttempt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeadLetterEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CronRun_job_createdAt_idx" ON "CronRun"("job", "createdAt");

-- CreateIndex
CREATE INDEX "DeadLetterEntry_type_resolvedAt_idx" ON "DeadLetterEntry"("type", "resolvedAt");

-- CreateIndex
CREATE INDEX "DeadLetterEntry_createdAt_idx" ON "DeadLetterEntry"("createdAt");
