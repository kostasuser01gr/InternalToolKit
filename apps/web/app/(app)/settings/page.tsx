import { redirect } from "next/navigation";

import { ThemePreference } from "@prisma/client";

import { RequestAccessButton } from "@/components/kit/request-access-button";
import { GlassCard } from "@/components/kit/glass-card";
import { SubmitButton } from "@/components/kit/submit-button";
import { PageHeader } from "@/components/layout/page-header";
import { SignOutButton } from "@/components/layout/signout-button";
import { StatusBanner } from "@/components/layout/status-banner";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UiPreferencesPanel } from "@/components/layout/ui-preferences-panel";
import { IntegrationsWizard } from "@/components/settings/integrations-wizard";
import { RoleShortcutsEditor } from "@/components/settings/role-shortcuts-editor";
import { StationCoordsEditor } from "@/components/settings/station-coords-editor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAppContext } from "@/lib/app-context";
import { listActiveSessionsForUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { isDatabaseUnavailableError } from "@/lib/prisma-errors";
import { mapServerError } from "@/lib/server-error";
import { SchemaFallbackBanner } from "@/components/layout/schema-fallback-banner";

import {
  createActionButtonAction,
  createPromptTemplateAction,
  createShortcutAction,
  deleteActionButtonAction,
  deletePromptTemplateAction,
  deleteShortcutAction,
  revokeAllSessionsAction,
  revokeCurrentSessionAction,
  revokeSessionAction,
  updatePreferencesAction,
  updateProfileAction,
} from "./actions";
import { getRoleShortcuts } from "./role-shortcuts-actions";

type SettingsPageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
    requestId?: string;
    errorId?: string;
  }>;
};

export default async function SettingsPage({
  searchParams,
}: SettingsPageProps) {
  const params = await searchParams;
  const { user, workspace, workspaceRole } = await getAppContext();

  const profile = await db.user.findUnique({
    where: { id: user.id },
  });

  if (!profile) {
    const { message, errorId, requestId } = await mapServerError(
      new Error("User profile not found."),
      "/settings",
    );
    redirect(
      `/settings?error=${encodeURIComponent(message)}&errorId=${errorId}&requestId=${requestId}`,
    );
  }

  const activeSessions = await listActiveSessionsForUser(user.id);
  // Tables added in migration 20260220181000 may not exist yet in older databases.
  // Fall back to empty arrays so the page renders instead of crashing.
  const schemaFallbackFlags = { triggered: false };
  function schemaFallback<T>(fallback: T) {
    return (err: unknown): T => {
      if (!isDatabaseUnavailableError(err)) throw err;
      schemaFallbackFlags.triggered = true;
      return fallback;
    };
  }

  const [shortcuts, actionButtons, promptTemplates, stations] = await Promise.all([
    db.userShortcut
      .findMany({
        where: { userId: user.id, workspaceId: workspace.id },
        orderBy: [{ createdAt: "desc" }],
      })
      .catch(schemaFallback([])),
    db.userActionButton
      .findMany({
        where: { userId: user.id, workspaceId: workspace.id },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      })
      .catch(schemaFallback([])),
    db.promptTemplate
      .findMany({
        where: { userId: user.id, workspaceId: workspace.id },
        orderBy: [{ createdAt: "desc" }],
      })
      .catch(schemaFallback([])),
    db.station
      .findMany({
        where: { workspaceId: workspace.id },
        orderBy: [{ name: "asc" }],
      })
      .catch(schemaFallback([])),
  ]);

  const roleShortcutsConfig = workspaceRole === "ADMIN"
    ? await getRoleShortcuts(workspace.id)
    : {};

  return (
    <div className="space-y-6" data-testid="settings-page">
      <PageHeader
        title="Settings"
        subtitle="Profile, theme, density, motion accessibility, notification preferences, and build details."
      />

      <SchemaFallbackBanner active={schemaFallbackFlags.triggered} />

      <StatusBanner
        error={params.error}
        success={params.success}
        requestId={params.requestId}
        errorId={params.errorId}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <GlassCard className="space-y-4">
          <h2 className="kpi-font text-xl font-semibold">Profile</h2>
          <form action={updateProfileAction} className="space-y-3">
            <input type="hidden" name="userId" value={profile.id} />
            <div className="space-y-1">
              <Label htmlFor="profile-name">Name</Label>
              <Input
                id="profile-name"
                name="name"
                defaultValue={profile.name}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="profile-email">Email</Label>
              <Input
                id="profile-email"
                value={profile.email}
                readOnly
                aria-readonly="true"
              />
            </div>
            <SubmitButton>Save profile</SubmitButton>
          </form>
        </GlassCard>

        <GlassCard className="space-y-4">
          <h2 className="kpi-font text-xl font-semibold">Theme & Preferences</h2>
          <ThemeToggle />
          <UiPreferencesPanel />

          <form
            action={updatePreferencesAction}
            className="space-y-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3"
          >
            <input type="hidden" name="userId" value={profile.id} />

            <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <input
                type="checkbox"
                name="notificationsEnabled"
                defaultChecked={profile.notificationsEnabled}
                className="focus-ring size-4 rounded border-[var(--border)] bg-white/10"
              />
              In-app notifications enabled
            </label>

            <div className="space-y-1">
              <Label htmlFor="themePreference">Theme preference</Label>
              <Select
                name="themePreference"
                defaultValue={profile.themePreference}
              >
                <SelectTrigger id="themePreference">
                  <SelectValue placeholder="Theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ThemePreference.DARK}>Dark</SelectItem>
                  <SelectItem value={ThemePreference.LIGHT}>Light</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <SubmitButton>Save preferences</SubmitButton>
          </form>
        </GlassCard>
      </div>

      <GlassCard className="space-y-4">
        <h2 className="kpi-font text-xl font-semibold">About</h2>
        <dl className="grid gap-2 text-sm text-[var(--text-muted)] md:grid-cols-2">
          <div>
            <dt className="font-medium text-[var(--text)]">Version</dt>
            <dd>{process.env.APP_VERSION ?? "0.1.0"}</dd>
          </div>
          <div>
            <dt className="font-medium text-[var(--text)]">Build</dt>
            <dd>{process.env.VERCEL_GIT_COMMIT_SHA ?? "local-build"}</dd>
          </div>
          <div>
            <dt className="font-medium text-[var(--text)]">Auth Model</dt>
            <dd>Cookie session adapter (httpOnly + sameSite) with route protection</dd>
          </div>
          <div>
            <dt className="font-medium text-[var(--text)]">Persistence</dt>
            <dd>Prisma + PostgreSQL (cloud authoritative, offline read cache only)</dd>
          </div>
        </dl>
        <SignOutButton />
      </GlassCard>

      <GlassCard className="space-y-4">
        <h2 className="kpi-font text-xl font-semibold">
          Cloud-Synced Chat Controls
        </h2>
        <p className="text-sm text-[var(--text-muted)]">
          Configure custom keyboard shortcuts, quick action buttons, and prompt
          templates. These settings sync per workspace and user.
        </p>

        <div className="grid gap-4 xl:grid-cols-3">
          <section className="space-y-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3">
            <h3 className="text-sm font-semibold">Shortcuts</h3>
            <form action={createShortcutAction} className="space-y-2">
              <input type="hidden" name="userId" value={profile.id} />
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <Input name="label" placeholder="Label (e.g. Daily Summary)" required />
              <Input name="command" placeholder="/summarize-table incidents" required />
              <Input name="keybinding" placeholder="Ctrl+Shift+S (optional)" />
              <SubmitButton>Add shortcut</SubmitButton>
            </form>
            <div className="space-y-2">
              {shortcuts.map((shortcut) => (
                <article
                  key={shortcut.id}
                  className="rounded-[var(--radius-xs)] border border-[var(--border)] bg-black/10 p-2 text-xs"
                >
                  <p className="font-medium text-[var(--text)]">{shortcut.label}</p>
                  <p className="text-[var(--text-muted)]">{shortcut.command}</p>
                  {shortcut.keybinding ? (
                    <p className="text-[var(--text-muted)]">{shortcut.keybinding}</p>
                  ) : null}
                  <form action={deleteShortcutAction} className="mt-2">
                    <input type="hidden" name="userId" value={profile.id} />
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <input type="hidden" name="shortcutId" value={shortcut.id} />
                    <SubmitButton>Remove</SubmitButton>
                  </form>
                </article>
              ))}
              {shortcuts.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">
                  No custom shortcuts yet.
                </p>
              ) : null}
            </div>
          </section>

          <section className="space-y-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3">
            <h3 className="text-sm font-semibold">Quick Action Buttons</h3>
            <form action={createActionButtonAction} className="space-y-2">
              <input type="hidden" name="userId" value={profile.id} />
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <Input name="label" placeholder="Label (e.g. New Shift)" required />
              <Input name="action" placeholder="/create-shift Title|Start|End" required />
              <Input name="position" placeholder="Position index (optional)" />
              <SubmitButton>Add quick action</SubmitButton>
            </form>
            <div className="space-y-2">
              {actionButtons.map((button) => (
                <article
                  key={button.id}
                  className="rounded-[var(--radius-xs)] border border-[var(--border)] bg-black/10 p-2 text-xs"
                >
                  <p className="font-medium text-[var(--text)]">
                    {button.position}. {button.label}
                  </p>
                  <p className="text-[var(--text-muted)]">{button.action}</p>
                  <form action={deleteActionButtonAction} className="mt-2">
                    <input type="hidden" name="userId" value={profile.id} />
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <input type="hidden" name="buttonId" value={button.id} />
                    <SubmitButton>Remove</SubmitButton>
                  </form>
                </article>
              ))}
              {actionButtons.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">
                  No quick action buttons yet.
                </p>
              ) : null}
            </div>
          </section>

          <section className="space-y-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3">
            <h3 className="text-sm font-semibold">Prompt Templates</h3>
            <form action={createPromptTemplateAction} className="space-y-2">
              <input type="hidden" name="userId" value={profile.id} />
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <Input name="title" placeholder="Title (e.g. Incident Digest)" required />
              <Input
                name="prompt"
                placeholder="Prompt text..."
                required
              />
              <SubmitButton>Add template</SubmitButton>
            </form>
            <div className="space-y-2">
              {promptTemplates.map((template) => (
                <article
                  key={template.id}
                  className="rounded-[var(--radius-xs)] border border-[var(--border)] bg-black/10 p-2 text-xs"
                >
                  <p className="font-medium text-[var(--text)]">{template.title}</p>
                  <p className="text-[var(--text-muted)]">
                    {template.prompt}
                  </p>
                  <form action={deletePromptTemplateAction} className="mt-2">
                    <input type="hidden" name="userId" value={profile.id} />
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <input type="hidden" name="templateId" value={template.id} />
                    <SubmitButton>Remove</SubmitButton>
                  </form>
                </article>
              ))}
              {promptTemplates.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">
                  No prompt templates yet.
                </p>
              ) : null}
            </div>
          </section>
        </div>
      </GlassCard>

      <GlassCard className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="kpi-font text-xl font-semibold">Active Sessions</h2>
          <div className="flex items-center gap-2">
            <form action={revokeAllSessionsAction}>
              <input type="hidden" name="userId" value={profile.id} />
              <SubmitButton>Revoke all others</SubmitButton>
            </form>
            <form action={revokeCurrentSessionAction}>
              <input type="hidden" name="userId" value={profile.id} />
              <SubmitButton>Revoke current</SubmitButton>
            </form>
          </div>
        </div>
        <div className="space-y-2">
          {activeSessions.map((session) => (
            <article
              key={session.id}
              className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3 text-sm"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="font-medium text-[var(--text)]">
                  {session.userAgent ?? "Unknown user agent"}
                </p>
                <span className="text-xs text-[var(--text-muted)]">
                  {session.isCurrent ? "Current session" : "Active"}
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Device: {session.deviceId ?? "n/a"}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                IP: {session.ipAddress ?? "n/a"}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Last seen: {session.lastSeenAt.toISOString()}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Expires: {session.expiresAt.toISOString()}
              </p>
              {!session.isCurrent ? (
                <form action={revokeSessionAction} className="mt-2">
                  <input type="hidden" name="userId" value={profile.id} />
                  <input type="hidden" name="sessionId" value={session.id} />
                  <SubmitButton>Revoke session</SubmitButton>
                </form>
              ) : null}
            </article>
          ))}
          {activeSessions.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No active sessions.</p>
          ) : null}
        </div>
      </GlassCard>

      {/* Governance / Workspace Settings (visible to all, editable by ADMIN only) */}
      <GlassCard className="space-y-4">
        <h2 className="kpi-font text-xl font-semibold">Workspace Settings</h2>
        <p className="text-sm text-[var(--text-muted)]">
          These settings are managed by workspace coordinators. You can view
          current policies and request changes.
        </p>

        {workspaceRole === "ADMIN" ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-sm text-emerald-200">
              You have full access to workspace settings.
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-[var(--border)] bg-white/5 p-3">
                <p className="text-sm font-medium text-[var(--text)]">Member Management</p>
                <p className="text-xs text-[var(--text-muted)]">Invite, remove, and manage roles</p>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-white/5 p-3">
                <p className="text-sm font-medium text-[var(--text)]">Security Policies</p>
                <p className="text-xs text-[var(--text-muted)]">Session timeouts, IP restrictions</p>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-white/5 p-3">
                <p className="text-sm font-medium text-[var(--text)]">Audit Log</p>
                <p className="text-xs text-[var(--text-muted)]">View all workspace activity</p>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-white/5 p-3">
                <p className="text-sm font-medium text-[var(--text)]">AI & Model Config</p>
                <p className="text-xs text-[var(--text-muted)]">Model routing, usage limits</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {[
              { feature: "Member Management", desc: "Invite/remove workspace members" },
              { feature: "Security Policies", desc: "Session & access control settings" },
              { feature: "Audit Log Access", desc: "View workspace activity log" },
              { feature: "AI & Model Config", desc: "Configure AI model routing" },
            ].map(({ feature, desc }) => (
              <div
                key={feature}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-white/5 p-3"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--text)]">{feature}</p>
                  <p className="text-xs text-[var(--text-muted)]">{desc}</p>
                </div>
                <RequestAccessButton feature={feature} />
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {workspaceRole === "ADMIN" ? (
        <StationCoordsEditor
          stations={stations.map((s) => {
            const config = s.configJson && typeof s.configJson === "object"
              ? (s.configJson as Record<string, unknown>)
              : {};
            return {
              id: s.id,
              name: s.name,
              code: s.code,
              lat: typeof config.lat === "number" ? config.lat : null,
              lon: typeof config.lon === "number" ? config.lon : null,
            };
          })}
          workspaceId={workspace.id}
        />
      ) : null}

      {workspaceRole === "ADMIN" ? (
        <GlassCard className="space-y-4">
          <h2 className="kpi-font text-xl font-semibold">Role-Recommended Shortcuts</h2>
          <RoleShortcutsEditor
            workspaceId={workspace.id}
            initial={roleShortcutsConfig}
          />
        </GlassCard>
      ) : null}

      {workspaceRole === "ADMIN" ? <IntegrationsWizard /> : null}
    </div>
  );
}
