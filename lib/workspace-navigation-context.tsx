"use client";

import { createContext } from "react";

export const WorkspaceNavigationContext = createContext<{ view: string; eventId?: string; navigate: (view: string) => void } | null>(null);
