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
        "mb-6 flex flex-wrap items-start justify-between gap-4",
        className,
      )}
    >
      <div className="space-y-1.5">
        <Breadcrumbs className="hidden lg:flex" />
        <h1 className="kpi-font text-2xl font-semibold tracking-tight md:text-3xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-sm text-[var(--text-muted)]">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </header>
  );
}

export { PageHeader };
