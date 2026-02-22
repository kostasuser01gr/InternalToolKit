import { VehicleEventType, VehicleStatus } from "@prisma/client";
import { z } from "zod";

export const createVehicleSchema = z.object({
  workspaceId: z.string().min(1),
  plateNumber: z.string().trim().min(3).max(20),
  model: z.string().trim().min(2).max(80),
  status: z.nativeEnum(VehicleStatus),
  mileageKm: z.coerce.number().int().min(0).max(2_000_000),
  fuelPercent: z.coerce.number().int().min(0).max(100),
  notes: z.string().trim().max(1000).optional(),
});

export const updateVehicleSchema = z.object({
  workspaceId: z.string().min(1),
  vehicleId: z.string().min(1),
  status: z.nativeEnum(VehicleStatus),
  mileageKm: z.coerce.number().int().min(0).max(2_000_000),
  fuelPercent: z.coerce.number().int().min(0).max(100),
  notes: z.string().trim().max(1000).optional(),
});

export const createVehicleEventSchema = z.object({
  workspaceId: z.string().min(1),
  vehicleId: z.string().min(1),
  type: z.nativeEnum(VehicleEventType),
  valueText: z.string().trim().max(120).optional(),
  valueNumber: z.coerce.number().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const transitionVehicleSchema = z.object({
  workspaceId: z.string().min(1),
  vehicleId: z.string().min(1),
  targetStatus: z.nativeEnum(VehicleStatus),
  notes: z.string().trim().max(1000).optional(),
});

export const qcSignoffSchema = z.object({
  workspaceId: z.string().min(1),
  vehicleId: z.string().min(1),
  result: z.enum(["PASS", "FAIL"]),
  failReason: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
});
