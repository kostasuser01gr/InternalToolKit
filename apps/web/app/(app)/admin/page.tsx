import { WorkspaceRole } from "@prisma/client";

import { GlassCard } from "@/components/kit/glass-card";
import { PrimaryButton } from "@/components/kit/primary-button";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBanner } from "@/components/layout/status-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { USAGE_LIMITS } from "@/lib/constants/limits";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/app-context";
import { hasRecentAdminStepUp } from "@/lib/auth/session";
import { isSchemaNotReadyError } from "@/lib/prisma-errors";

import {
  inviteMemberAction,
  removeMemberAction,
  updateMemberRoleAction,
  verifyAdminStepUpAction,
} from "./actions";

type AdminPageProps = {
  searchParams: Promise<{
    workspaceId?: string;
    actor?: string;
    action?: string;
    entity?: string;
    error?: string;
    success?: string;
    inviteCode?: string;
    requestId?: string;
    errorId?: string;
  }>;
};

function queryString(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      query.set(key, value);
    }
  }

  return `/admin?${query.toString()}`;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const { user, workspace, workspaceRole } = await getAppContext(
    params.workspaceId,
  );
  const stepUpActive = await hasRecentAdminStepUp();

  const isAdmin =
    user.roleGlobal === "ADMIN" || workspaceRole === WorkspaceRole.ADMIN;

  if (!isAdmin) {
    return (
      <GlassCard className="space-y-3" data-testid="admin-blocked">
        <h1 className="kpi-font text-2xl font-semibold">
          Admin access required
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          Your role does not include administration rights for this workspace.
        </p>
      </GlassCard>
    );
  }

  const auditWhere = {
    workspaceId: workspace.id,
    ...(params.actor ? { actorUserId: params.actor } : {}),
    ...(params.action ? { action: { contains: params.action } } : {}),
    ...(params.entity ? { entityType: { contains: params.entity } } : {}),
  };

  function safeCount(p: Promise<number>) {
    return p.catch((err: unknown) => {
      if (!isSchemaNotReadyError(err)) throw err;
      return 0;
    });
  }
  function safeFindMany<T>(p: Promise<T[]>) {
    return p.catch((err: unknown): T[] => {
      if (!isSchemaNotReadyError(err)) throw err;
      return [];
    });
  }

  const [members, counts, auditLogs] = await Promise.all([
    safeFindMany(db.workspaceMember.findMany({
      where: { workspaceId: workspace.id },
      include: {
        user: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    })),
    Promise.all([
      safeCount(db.table.count({ where: { workspaceId: workspace.id } })),
      safeCount(db.record.count({ where: { table: { workspaceId: workspace.id } } })),
      safeCount(db.automation.count({ where: { workspaceId: workspace.id } })),
    ]),
    safeFindMany(db.auditLog.findMany({
      where: auditWhere,
      include: {
        actor: true,
      },
      orderBy: { createdAt: "desc" },
      take: 60,
    })),
  ]);

  const [tableCount, recordCount, automationCount] = counts;

  return (
    <div className="space-y-6" data-testid="admin-page">
      <PageHeader
        title="Admin"
        subtitle="Manage workspace roles, review audit activity, and monitor usage guardrails."
      />

      <StatusBanner
        error={params.error}
        success={params.success}
        requestId={params.requestId}
        errorId={params.errorId}
      />

      {params.inviteCode ? (
        <GlassCard className="space-y-3">
          <h2 className="kpi-font text-lg font-semibold">One-time invite code</h2>
          <p className="text-sm text-[var(--text-muted)]">
            Share this once. It expires on first use or when its TTL elapses.
          </p>
          <p className="break-all rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 px-3 py-2 font-mono text-xs text-[var(--text)]">
            {params.inviteCode}
          </p>
          <a
            href={`/accept-invite?code=${encodeURIComponent(params.inviteCode)}`}
            className="text-sm text-[#9a6fff] hover:underline"
          >
            Open invite URL
          </a>
        </GlassCard>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <GlassCard className="space-y-4">
          <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-[var(--text)]">Admin step-up</p>
              <Badge variant={stepUpActive ? "active" : "default"}>
                {stepUpActive ? "verified" : "required"}
              </Badge>
            </div>
            <p className="mb-3 text-xs text-[var(--text-muted)]">
              Re-enter your PIN to unlock member invite/role/remove actions for
              10 minutes.
            </p>
            <form
              action={verifyAdminStepUpAction}
              className="grid gap-2 sm:grid-cols-[160px,auto]"
            >
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <Input
                name="pin"
                type="password"
                inputMode="numeric"
                pattern="\d{4}"
                minLength={4}
                maxLength={4}
                placeholder="Admin PIN"
                required
              />
              <PrimaryButton type="submit">Verify admin PIN</PrimaryButton>
            </form>
          </div>

          <h2 className="kpi-font text-xl font-semibold">Workspace Members</h2>

          <form
            action={inviteMemberAction}
            className="grid gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3 sm:grid-cols-[1fr,160px,auto]"
          >
            <input type="hidden" name="workspaceId" value={workspace.id} />
            <Input
              name="email"
              type="email"
              placeholder="new.member@internal.local"
              required
            />
            <Select name="role" defaultValue={WorkspaceRole.VIEWER}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={WorkspaceRole.ADMIN}>ADMIN</SelectItem>
                <SelectItem value={WorkspaceRole.EDITOR}>EDITOR</SelectItem>
                <SelectItem value={WorkspaceRole.VIEWER}>VIEWER</SelectItem>
              </SelectContent>
            </Select>
            <PrimaryButton type="submit">Invite</PrimaryButton>
          </form>

          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.userId}
                className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-[var(--text)]">
                      {member.user.email}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {member.user.name}
                    </p>
                  </div>
                  <Badge
                    variant={
                      member.role === WorkspaceRole.ADMIN ? "active" : "default"
                    }
                  >
                    {member.role}
                  </Badge>
                </div>
                <div className="grid gap-2 sm:grid-cols-[160px,auto,auto]">
                  <form action={updateMemberRoleAction} className="contents">
                    <input
                      type="hidden"
                      name="workspaceId"
                      value={workspace.id}
                    />
                    <input type="hidden" name="userId" value={member.userId} />
                    <Select name="role" defaultValue={member.role}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={WorkspaceRole.ADMIN}>
                          ADMIN
                        </SelectItem>
                        <SelectItem value={WorkspaceRole.EDITOR}>
                          EDITOR
                        </SelectItem>
                        <SelectItem value={WorkspaceRole.VIEWER}>
                          VIEWER
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Button type="submit" variant="outline">
                      Update
                    </Button>
                  </form>

                  <form action={removeMemberAction}>
                    <input
                      type="hidden"
                      name="workspaceId"
                      value={workspace.id}
                    />
                    <input type="hidden" name="userId" value={member.userId} />
                    <Button
                      type="submit"
                      variant="ghost"
                      disabled={member.userId === workspace.ownerId}
                    >
                      Remove
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="space-y-4">
          <h2 className="kpi-font text-xl font-semibold">Usage Guardrails</h2>
          <div className="space-y-2 text-sm text-[var(--text-muted)]">
            <p>
              Tables: <span className="text-[var(--text)]">{tableCount}</span> /{" "}
              {USAGE_LIMITS.maxTablesPerWorkspace}
            </p>
            <p>
              Records per workspace:{" "}
              <span className="text-[var(--text)]">{recordCount}</span>
            </p>
            <p>
              Max records per table:{" "}
              <span className="text-[var(--text)]">
                {USAGE_LIMITS.maxRecordsPerTable}
              </span>
            </p>
            <p>
              Automations:{" "}
              <span className="text-[var(--text)]">{automationCount}</span> /{" "}
              {USAGE_LIMITS.maxAutomationsPerWorkspace}
            </p>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Guardrails are enforced server-side on table creation, record
            creation/import, and automation creation.
          </p>
        </GlassCard>
      </div>

      <GlassCard className="space-y-4">
        <h2 className="kpi-font text-xl font-semibold">Audit Log</h2>
        <form method="get" className="grid gap-2 md:grid-cols-4">
          <input type="hidden" name="workspaceId" value={workspace.id} />
          <div className="space-y-1">
            <Label htmlFor="actor">Actor user ID</Label>
            <Input id="actor" name="actor" defaultValue={params.actor} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="action">Action contains</Label>
            <Input id="action" name="action" defaultValue={params.action} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="entity">Entity contains</Label>
            <Input id="entity" name="entity" defaultValue={params.entity} />
          </div>
          <div className="flex items-end">
            <PrimaryButton type="submit" className="w-full">
              Filter
            </PrimaryButton>
          </div>
        </form>

        <div className="space-y-2">
          {auditLogs.map((entry) => (
            <div
              key={entry.id}
              className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/5 p-3 text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-[var(--text)]">{entry.action}</p>
                <Badge variant="default">{entry.entityType}</Badge>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Actor: {entry.actor?.email ?? "system"} · Entity:{" "}
                {entry.entityId}
              </p>
            </div>
          ))}
          {auditLogs.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              No logs for selected filters.
            </p>
          ) : null}
        </div>

        <a
          href={queryString({ workspaceId: workspace.id })}
          className="focus-ring text-sm text-[#9a6fff]"
        >
          Clear filters
        </a>
      </GlassCard>
    </div>
  );
}
