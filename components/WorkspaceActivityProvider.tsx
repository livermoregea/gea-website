"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type Activity = "saving" | "refreshing";
const ActivityContext = createContext<{
  activity: Activity | null;
  report: (id: string, activity: Activity | null) => void;
} | null>(null);

export function WorkspaceActivityProvider({ children }: { children: React.ReactNode }) {
  const [sources, setSources] = useState<Record<string, Activity>>({});
  const report = useCallback((id: string, activity: Activity | null) => {
    setSources(previous => {
      if (previous[id] === activity || (!activity && !(id in previous))) return previous;
      const next = { ...previous };
      if (activity) next[id] = activity;
      else delete next[id];
      return next;
    });
  }, []);
  const values = Object.values(sources);
  const activity: Activity | null = values.includes("saving") ? "saving" : values.length ? "refreshing" : null;
  const value = useMemo(() => ({ activity, report }), [activity, report]);
  return <ActivityContext.Provider value={value}>{children}</ActivityContext.Provider>;
}

export function useWorkspaceActivity() {
  return useContext(ActivityContext);
}
