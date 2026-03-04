import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
};

function PageHeader({ title, subtitle, action, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "mb-5 flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] px-4 py-4 shadow-[0_16px_44px_rgba(6,10,22,0.35)] md:px-5",
        className,
      )}
    >
      <div className="space-y-1.5">
        <Breadcrumbs className="hidden lg:flex" />
        <h1 className="kpi-font text-2xl font-semibold tracking-tight text-[var(--text)] md:text-3xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="max-w-[72ch] text-sm text-[var(--text-muted)]">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="ml-auto flex items-center gap-2">{action}</div> : null}
    </header>
  );
}

export { PageHeader };
