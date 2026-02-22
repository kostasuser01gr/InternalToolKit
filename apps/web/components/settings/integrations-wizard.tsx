"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, RefreshCw, Wifi, WifiOff } from "lucide-react";

import { GlassCard } from "@/components/kit/glass-card";
import { PrimaryButton } from "@/components/kit/primary-button";

type IntegrationStatus = {
  name: string;
  envKey: string;
  configured: boolean;
  description: string;
  setupUrl?: string;
  testable: boolean;
};

type ViberStatus = {
  enabled: boolean;
  ready: boolean;
  mode: string;
  mirroredChannels: string[];
  channelApiConfigured: boolean;
  botApiConfigured: boolean;
  deadLetterCount: number;
  lastSuccessAt: string | null;
  lastSuccessItem: string | null;
  successCount: number;
};

export function IntegrationsWizard() {
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [viberStatus, setViberStatus] = useState<ViberStatus | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const [intRes, vRes] = await Promise.all([
        fetch("/api/integrations/status"),
        fetch("/api/viber"),
      ]);
      if (intRes.ok) setIntegrations(await intRes.json());
      if (vRes.ok) setViberStatus(await vRes.json());
    } catch {
      // silently fail — integrations page is non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  async function testIntegration(envKey: string) {
    setTesting(envKey);
    try {
      const res = await fetch(`/api/integrations/test?key=${encodeURIComponent(envKey)}`);
      const data = await res.json();
      setTestResult((prev) => ({ ...prev, [envKey]: data }));
    } catch {
      setTestResult((prev) => ({ ...prev, [envKey]: { ok: false, message: "Test failed" } }));
    } finally {
      setTesting(null);
    }
  }

  async function retryViber() {
    setTesting("viber-retry");
    try {
      await fetch("/api/viber", { method: "POST", body: JSON.stringify({ action: "retry" }), headers: { "Content-Type": "application/json" } });
      await fetchStatus();
    } finally {
      setTesting(null);
    }
  }

  if (loading) {
    return (
      <GlassCard className="space-y-4">
        <h2 className="kpi-font text-xl font-semibold">Integrations</h2>
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <Loader2 className="size-4 animate-spin" /> Loading integration status…
        </div>
      </GlassCard>
    );
  }

  return (
    <>
      <GlassCard className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="kpi-font text-xl font-semibold">Integrations Setup</h2>
          <button onClick={fetchStatus} className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--text)]" title="Refresh">
            <RefreshCw className="size-4" />
          </button>
        </div>
        <p className="text-sm text-[var(--text-muted)]">
          Configure API keys and tokens for external integrations. Keys must be set as environment
          variables in Vercel (or <code className="rounded bg-white/10 px-1">.env.local</code> for local dev).
        </p>

        <div className="space-y-3">
          {integrations.map((int) => (
            <div key={int.envKey} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-white/5 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {int.configured ? (
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="size-4 shrink-0 text-amber-400" />
                  )}
                  <p className="text-sm font-medium text-[var(--text)]">{int.name}</p>
                </div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{int.description}</p>
                <p className="mt-1 font-mono text-xs text-[var(--text-muted)]">{int.envKey}</p>
                {testResult[int.envKey] ? (
                  <p className={`mt-1 text-xs ${testResult[int.envKey]!.ok ? "text-emerald-400" : "text-red-400"}`}>
                    {testResult[int.envKey]!.message}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {int.setupUrl ? (
                  <a href={int.setupUrl} target="_blank" rel="noopener noreferrer"
                    className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--text)]" title="Setup docs">
                    <ExternalLink className="size-4" />
                  </a>
                ) : null}
                {int.testable && int.configured ? (
                  <PrimaryButton onClick={() => testIntegration(int.envKey)} disabled={testing === int.envKey}>
                    {testing === int.envKey ? <Loader2 className="size-3 animate-spin" /> : "Test"}
                  </PrimaryButton>
                ) : null}
              </div>
            </div>
          ))}
          {integrations.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">No integrations detected.</p>
          ) : null}
        </div>
      </GlassCard>

      {viberStatus ? (
        <GlassCard className="space-y-4">
          <h2 className="kpi-font text-xl font-semibold">Viber Channel Mirror</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-[var(--border)] bg-white/5 p-3 text-center">
              <div className="flex items-center justify-center gap-1">
                {viberStatus.ready ? <Wifi className="size-4 text-emerald-400" /> : <WifiOff className="size-4 text-amber-400" />}
              </div>
              <p className="mt-1 text-lg font-bold text-[var(--text)]">{viberStatus.ready ? "Ready" : "Not Ready"}</p>
              <p className="text-xs text-[var(--text-muted)]">Status</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-white/5 p-3 text-center">
              <p className="text-lg font-bold text-[var(--text)]">{viberStatus.successCount}</p>
              <p className="text-xs text-[var(--text-muted)]">Messages sent</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-white/5 p-3 text-center">
              <p className="text-lg font-bold text-[var(--text)]">{viberStatus.deadLetterCount}</p>
              <p className="text-xs text-[var(--text-muted)]">Dead letters</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-white/5 p-3 text-center">
              <p className="text-lg font-bold text-[var(--text)]">{viberStatus.mirroredChannels.join(", ") || "none"}</p>
              <p className="text-xs text-[var(--text-muted)]">Mirrored channels</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
            <span>Mode: {viberStatus.mode}</span>
            <span>Channel API: {viberStatus.channelApiConfigured ? "✓" : "✗"}</span>
            <span>Bot API: {viberStatus.botApiConfigured ? "✓" : "✗"}</span>
            {viberStatus.lastSuccessAt ? <span>Last success: {new Date(viberStatus.lastSuccessAt).toLocaleString()}</span> : null}
          </div>
          {viberStatus.deadLetterCount > 0 ? (
            <PrimaryButton onClick={retryViber} disabled={testing === "viber-retry"}>
              {testing === "viber-retry" ? <Loader2 className="size-3 animate-spin" /> : `Retry ${viberStatus.deadLetterCount} failed`}
            </PrimaryButton>
          ) : null}
        </GlassCard>
      ) : null}
    </>
  );
}
