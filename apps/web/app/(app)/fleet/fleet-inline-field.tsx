"use client";

import { useRouter } from "next/navigation";

import { InlineEdit, pushUndo } from "@/components/kit/inline-edit";

import { inlineUpdateVehicleFieldAction } from "./inline-actions";

type FleetInlineFieldProps = {
  workspaceId: string;
  vehicleId: string;
  field: string;
  value: string;
  disabled?: boolean;
  placeholder?: string;
};

export function FleetInlineField({
  workspaceId,
  vehicleId,
  field,
  value,
  disabled = false,
  placeholder,
}: FleetInlineFieldProps) {
  const router = useRouter();

  return (
    <InlineEdit
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      optimistic
      onSave={async (newValue) => {
        const previousValue = value;
        const result = await inlineUpdateVehicleFieldAction({
          workspaceId,
          vehicleId,
          field,
          value: newValue,
        });

        if (!result.ok) {
          throw new Error(result.error);
        }

        pushUndo({
          id: `vehicle-${vehicleId}-${field}`,
          label: `Undo ${field} change`,
          undo: async () => {
            await inlineUpdateVehicleFieldAction({
              workspaceId,
              vehicleId,
              field,
              value: previousValue,
            });
            router.refresh();
          },
        });

        router.refresh();
      }}
    />
  );
}
