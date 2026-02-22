"use client";

import { useRouter } from "next/navigation";

import { InlineEdit, pushUndo } from "@/components/kit/inline-edit";

import { inlineUpdateShiftFieldAction } from "./shift-inline-actions";

type ShiftInlineFieldProps = {
  workspaceId: string;
  shiftId: string;
  field: "title" | "notes";
  value: string;
  disabled?: boolean | undefined;
  placeholder?: string | undefined;
};

export function ShiftInlineField({
  workspaceId,
  shiftId,
  field,
  value,
  disabled,
  placeholder,
}: ShiftInlineFieldProps) {
  const router = useRouter();

  return (
    <InlineEdit
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onSave={async (newValue: string) => {
        const result = await inlineUpdateShiftFieldAction({
          workspaceId,
          shiftId,
          field,
          value: newValue,
        });
        if (!result.ok) throw new Error(result.error);

        pushUndo({
          id: `shift-${field}-${shiftId}-${Date.now()}`,
          label: `Undo shift ${field} edit`,
          undo: async () => {
            await inlineUpdateShiftFieldAction({
              workspaceId,
              shiftId,
              field,
              value,
            });
            router.refresh();
          },
        });
        router.refresh();
      }}
    />
  );
}
