"use client";

import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const syncStatus = () => setIsOffline(!navigator.onLine);

    syncStatus();
    window.addEventListener("online", syncStatus);
    window.addEventListener("offline", syncStatus);

    return () => {
      window.removeEventListener("online", syncStatus);
      window.removeEventListener("offline", syncStatus);
    };
  }, []);

  if (!isOffline) {
    return null;
  }

  return (
    <div className="fixed top-2 right-2 left-2 z-[60] rounded-[var(--radius-sm)] border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-sm text-amber-100 backdrop-blur-lg">
      <div className="flex items-center gap-2">
        <WifiOff className="size-4" aria-hidden="true" />
        You are offline. Cached cloud data may be stale until connection returns.
      </div>
    </div>
  );
}

export { OfflineBanner };
