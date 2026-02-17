import { ThemePreference } from "@prisma/client";

import { GlassCard } from "@/components/kit/glass-card";
import { PrimaryButton } from "@/components/kit/primary-button";
import { PageHeader } from "@/components/layout/page-header";
import { SignOutButton } from "@/components/layout/signout-button";
import { StatusBanner } from "@/components/layout/status-banner";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UiPreferencesPanel } from "@/components/layout/ui-preferences-panel";
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
import { db } from "@/lib/db";

import { updatePreferencesAction, updateProfileAction } from "./actions";

type SettingsPageProps = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

export default async function SettingsPage({
  searchParams,
}: SettingsPageProps) {
  const params = await searchParams;
  const { user } = await getAppContext();

  const profile = await db.user.findUniqueOrThrow({
    where: { id: user.id },
  });

  return (
    <div className="space-y-6" data-testid="settings-page">
      <PageHeader
        title="Settings"
        subtitle="Profile, theme, density, motion accessibility, notification preferences, and build details."
      />

      <StatusBanner error={params.error} success={params.success} />

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
            <PrimaryButton type="submit">Save profile</PrimaryButton>
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

            <PrimaryButton type="submit">Save preferences</PrimaryButton>
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
            <dd>Prisma + SQLite (portable to PostgreSQL)</dd>
          </div>
        </dl>
        <SignOutButton />
      </GlassCard>
    </div>
  );
}
