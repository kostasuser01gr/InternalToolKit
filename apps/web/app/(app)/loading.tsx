export default function AppLoading() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="glass-surface skeleton h-36 rounded-[var(--radius-md)]"
          aria-hidden="true"
        />
      ))}
      <span className="sr-only">Loading dashboard data</span>
    </div>
  );
}
