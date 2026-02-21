-- AlterTable
ALTER TABLE "WasherTask" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "WasherTask" ADD COLUMN "deviceId" TEXT;
ALTER TABLE "WasherTask" ADD COLUMN "stationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "WasherTask_idempotencyKey_key" ON "WasherTask"("idempotencyKey");
