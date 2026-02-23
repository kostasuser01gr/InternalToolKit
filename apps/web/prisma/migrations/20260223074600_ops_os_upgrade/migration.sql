-- CreateEnum
CREATE TYPE "FleetPipelineState" AS ENUM ('RETURNED', 'NEEDS_CLEANING', 'CLEANING', 'QC_PENDING', 'READY', 'RENTED', 'BLOCKED', 'MAINTENANCE', 'OUT_OF_SERVICE');

-- CreateEnum
CREATE TYPE "QcStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'REWORK');

-- AlterTable: Vehicle — add new columns
ALTER TABLE "Vehicle" ADD COLUMN "pipelineState" "FleetPipelineState" NOT NULL DEFAULT 'READY';
ALTER TABLE "Vehicle" ADD COLUMN "slaBreachedAt" TIMESTAMP(3);
ALTER TABLE "Vehicle" ADD COLUMN "needByAt" TIMESTAMP(3);
ALTER TABLE "Vehicle" ADD COLUMN "keyLocation" TEXT;

-- CreateIndex
CREATE INDEX "Vehicle_workspaceId_pipelineState_idx" ON "Vehicle"("workspaceId", "pipelineState");

-- CreateTable
CREATE TABLE "ImportChangeSet" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "beforeJson" JSONB,
    "afterJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportChangeSet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportChangeSet_batchId_idx" ON "ImportChangeSet"("batchId");

-- CreateIndex
CREATE INDEX "ImportChangeSet_entityType_entityId_idx" ON "ImportChangeSet"("entityType", "entityId");

-- CreateTable
CREATE TABLE "WeatherCache" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "dataJson" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeatherCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeatherCache_lat_lon_expiresAt_idx" ON "WeatherCache"("lat", "lon", "expiresAt");

-- CreateIndex
CREATE INDEX "WeatherCache_workspaceId_idx" ON "WeatherCache"("workspaceId");

-- CreateTable
CREATE TABLE "VehicleQcLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "inspectorId" TEXT,
    "status" "QcStatus" NOT NULL DEFAULT 'PENDING',
    "checklistJson" JSONB,
    "failReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleQcLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleQcLog_vehicleId_createdAt_idx" ON "VehicleQcLog"("vehicleId", "createdAt");

-- CreateIndex
CREATE INDEX "VehicleQcLog_workspaceId_status_idx" ON "VehicleQcLog"("workspaceId", "status");

-- AddForeignKey
ALTER TABLE "VehicleQcLog" ADD CONSTRAINT "VehicleQcLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleQcLog" ADD CONSTRAINT "VehicleQcLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleQcLog" ADD CONSTRAINT "VehicleQcLog_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "VehicleBlocker" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "reportedBy" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleBlocker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleBlocker_vehicleId_resolvedAt_idx" ON "VehicleBlocker"("vehicleId", "resolvedAt");

-- CreateIndex
CREATE INDEX "VehicleBlocker_workspaceId_idx" ON "VehicleBlocker"("workspaceId");

-- AddForeignKey
ALTER TABLE "VehicleBlocker" ADD CONSTRAINT "VehicleBlocker_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleBlocker" ADD CONSTRAINT "VehicleBlocker_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "KeyHandoverLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "fromUserId" TEXT,
    "toUserId" TEXT,
    "keyLocation" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeyHandoverLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KeyHandoverLog_vehicleId_createdAt_idx" ON "KeyHandoverLog"("vehicleId", "createdAt");

-- AddForeignKey
ALTER TABLE "KeyHandoverLog" ADD CONSTRAINT "KeyHandoverLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyHandoverLog" ADD CONSTRAINT "KeyHandoverLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
