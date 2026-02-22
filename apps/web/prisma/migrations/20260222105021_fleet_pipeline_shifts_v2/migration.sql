-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ShiftStatus" ADD VALUE 'REVIEW';
ALTER TYPE "ShiftStatus" ADD VALUE 'LOCKED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "VehicleEventType" ADD VALUE 'PIPELINE_TRANSITION';
ALTER TYPE "VehicleEventType" ADD VALUE 'QC_PASS';
ALTER TYPE "VehicleEventType" ADD VALUE 'QC_FAIL';
ALTER TYPE "VehicleEventType" ADD VALUE 'SLA_BREACH';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "VehicleStatus" ADD VALUE 'RETURNED';
ALTER TYPE "VehicleStatus" ADD VALUE 'CLEANING';
ALTER TYPE "VehicleStatus" ADD VALUE 'QC_PENDING';

-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "lockedBy" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "snapshotJson" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ShiftRequest" ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedBy" TEXT;

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "qcFailReason" TEXT,
ADD COLUMN     "qcResult" TEXT,
ADD COLUMN     "qcSignoffBy" TEXT,
ADD COLUMN     "slaDeadlineAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_lockedBy_fkey" FOREIGN KEY ("lockedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftRequest" ADD CONSTRAINT "ShiftRequest_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_qcSignoffBy_fkey" FOREIGN KEY ("qcSignoffBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
