"use client";

import { useEffect, useState } from "react";
import { formatFriendlyDateTime } from "@/lib/datetime/format";

export function HeaderClock() {
  const [now, setNow] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setNow(formatFriendlyDateTime(new Date()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <time
      dateTime={now ?? undefined}
      className="truncate text-xs tabular-nums text-header-muted sm:text-sm"
      suppressHydrationWarning
    >
      {now ?? "—"}
    </time>
  );
}
