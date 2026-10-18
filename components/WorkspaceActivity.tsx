"use client";

import { useEffect, useId } from "react";
import { useWorkspaceActivity } from "./WorkspaceActivityProvider";

export default function WorkspaceActivity({ saving = false, refreshing = false }: {
  saving?: boolean; refreshing?: boolean; background?: boolean; inline?: boolean;
}) {
  const id = useId();
  const report = useWorkspaceActivity()?.report;
  useEffect(() => {
    report?.(id, saving ? "saving" : refreshing ? "refreshing" : null);
    return () => report?.(id, null);
  }, [id, report, saving, refreshing]);

  // Activity is shown once, in the persistent header, including for dialogs
  // and nested panels. Each source unregisters itself when it unmounts.
  return null;
}
