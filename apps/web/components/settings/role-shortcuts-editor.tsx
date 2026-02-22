"use client";

import { useState, useTransition } from "react";

import { PrimaryButton } from "@/components/kit/primary-button";

import { saveRoleShortcutsAction } from "@/app/(app)/settings/role-shortcuts-actions";

type RoleShortcut = {
  id: string;
  label: string;
  command: string;
};

type RoleShortcutsConfig = Record<string, RoleShortcut[]>;

type RoleShortcutsEditorProps = {
  workspaceId: string;
  initial: RoleShortcutsConfig;
};

const AVAILABLE_ROLES = ["ADMIN", "EDITOR", "EMPLOYEE", "WASHER", "VIEWER"];

export function RoleShortcutsEditor({ workspaceId, initial }: RoleShortcutsEditorProps) {
  const [config, setConfig] = useState<RoleShortcutsConfig>(initial);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [activeRole, setActiveRole] = useState(AVAILABLE_ROLES[0]!);

  const roleShortcuts = config[activeRole] ?? [];

  const addShortcut = () => {
    const id = `rs-${activeRole.toLowerCase()}-${Date.now()}`;
    setConfig((prev) => ({
      ...prev,
      [activeRole]: [...(prev[activeRole] ?? []), { id, label: "", command: "" }],
    }));
  };

  const updateShortcut = (index: number, field: "label" | "command", value: string) => {
    setConfig((prev) => {
      const arr = [...(prev[activeRole] ?? [])];
      arr[index] = { ...arr[index]!, [field]: value };
      return { ...prev, [activeRole]: arr };
    });
  };

  const removeShortcut = (index: number) => {
    setConfig((prev) => {
      const arr = [...(prev[activeRole] ?? [])];
      arr.splice(index, 1);
      return { ...prev, [activeRole]: arr };
    });
  };

  const handleSave = () => {
    startTransition(async () => {
      // Filter out empty entries
      const cleaned: RoleShortcutsConfig = {};
      for (const [role, shortcuts] of Object.entries(config)) {
        const valid = shortcuts.filter((s) => s.label.trim() && s.command.trim());
        if (valid.length > 0) cleaned[role] = valid;
      }

      const result = await saveRoleShortcutsAction({
        workspaceId,
        roleShortcuts: cleaned,
      });

      if (result.ok) {
        setMessage("Role shortcuts saved.");
        setConfig(cleaned);
      } else {
        setMessage(`Error: ${result.error}`);
      }

      setTimeout(() => setMessage(null), 3000);
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-muted)]">
        Configure recommended shortcuts per role. Users see these as suggestions in their Quick Bar.
      </p>

      {/* Role tabs */}
      <div className="flex flex-wrap gap-1">
        {AVAILABLE_ROLES.map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => setActiveRole(role)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              activeRole === role
                ? "bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/40"
                : "border border-[var(--border)] text-[var(--text-muted)] hover:bg-white/5"
            }`}
          >
            {role}
            {(config[role]?.length ?? 0) > 0 && (
              <span className="ml-1 text-[10px] opacity-70">({config[role]!.length})</span>
            )}
          </button>
        ))}
      </div>

      {/* Shortcuts list for active role */}
      <div className="space-y-2">
        {roleShortcuts.map((shortcut, i) => (
          <div key={shortcut.id} className="flex items-center gap-2">
            <input
              type="text"
              value={shortcut.label}
              onChange={(e) => updateShortcut(i, "label", e.target.value)}
              placeholder="Label (e.g. Settings)"
              className="focus-ring h-8 flex-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/6 px-2 text-sm text-[var(--text)]"
            />
            <input
              type="text"
              value={shortcut.command}
              onChange={(e) => updateShortcut(i, "command", e.target.value)}
              placeholder="Command (e.g. route /settings)"
              className="focus-ring h-8 flex-[2] rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/6 px-2 text-sm text-[var(--text)]"
            />
            <button
              type="button"
              onClick={() => removeShortcut(i)}
              className="text-xs text-rose-400 hover:text-rose-300"
            >
              ✕
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addShortcut}
          className="rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-muted)] hover:bg-white/5"
        >
          + Add shortcut for {activeRole}
        </button>
      </div>

      {message && (
        <p className={`text-sm ${message.startsWith("Error") ? "text-rose-400" : "text-emerald-400"}`}>
          {message}
        </p>
      )}

      <PrimaryButton
        type="button"
        onClick={handleSave}
        disabled={isPending}
      >
        Save role shortcuts
      </PrimaryButton>
    </div>
  );
}
