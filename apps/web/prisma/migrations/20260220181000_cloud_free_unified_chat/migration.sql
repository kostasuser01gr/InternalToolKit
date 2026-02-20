-- Free-only cloud chat + shortcuts + artifacts schema extensions

CREATE TYPE "ChatMessageStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');
CREATE TYPE "ChatArtifactType" AS ENUM ('MARKDOWN', 'JSON', 'TASK', 'AUTOMATION', 'REPORT');

ALTER TABLE "ChatMessage"
  ADD COLUMN "modelId" TEXT,
  ADD COLUMN "latencyMs" INTEGER,
  ADD COLUMN "tokenUsage" INTEGER,
  ADD COLUMN "status" "ChatMessageStatus" NOT NULL DEFAULT 'COMPLETED',
  ADD COLUMN "commandName" TEXT,
  ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "ChatMessage_threadId_isPinned_createdAt_idx"
  ON "ChatMessage"("threadId", "isPinned", "createdAt");

CREATE TABLE "ChatArtifact" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "messageId" TEXT,
  "createdById" TEXT,
  "type" "ChatArtifactType" NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatArtifact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChatArtifact_workspaceId_createdAt_idx"
  ON "ChatArtifact"("workspaceId", "createdAt");
CREATE INDEX "ChatArtifact_messageId_idx"
  ON "ChatArtifact"("messageId");

ALTER TABLE "ChatArtifact"
  ADD CONSTRAINT "ChatArtifact_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ChatArtifact_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ChatArtifact_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "UserShortcut" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "command" TEXT NOT NULL,
  "keybinding" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserShortcut_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserShortcut_workspaceId_userId_createdAt_idx"
  ON "UserShortcut"("workspaceId", "userId", "createdAt");

ALTER TABLE "UserShortcut"
  ADD CONSTRAINT "UserShortcut_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "UserShortcut_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "UserActionButton" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserActionButton_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserActionButton_workspaceId_userId_position_idx"
  ON "UserActionButton"("workspaceId", "userId", "position");

ALTER TABLE "UserActionButton"
  ADD CONSTRAINT "UserActionButton_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "UserActionButton_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PromptTemplate" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PromptTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PromptTemplate_workspaceId_userId_createdAt_idx"
  ON "PromptTemplate"("workspaceId", "userId", "createdAt");

ALTER TABLE "PromptTemplate"
  ADD CONSTRAINT "PromptTemplate_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PromptTemplate_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AiUsageMeter" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT,
  "windowDate" TIMESTAMP(3) NOT NULL,
  "requestsUsed" INTEGER NOT NULL DEFAULT 0,
  "tokensUsed" INTEGER NOT NULL DEFAULT 0,
  "provider" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiUsageMeter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiUsageMeter_workspaceId_userId_windowDate_provider_key"
  ON "AiUsageMeter"("workspaceId", "userId", "windowDate", "provider");
CREATE INDEX "AiUsageMeter_workspaceId_windowDate_idx"
  ON "AiUsageMeter"("workspaceId", "windowDate");

ALTER TABLE "AiUsageMeter"
  ADD CONSTRAINT "AiUsageMeter_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AiUsageMeter_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
