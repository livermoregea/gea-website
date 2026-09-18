"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_LEADERSHIP_ROLES, loadLeadershipRoles } from "@/lib/leadership-roles";

export function useLeadershipRoles() {
  const [roles, setRoles] = useState(DEFAULT_LEADERSHIP_ROLES);
  useEffect(() => {
    let mounted = true;
    loadLeadershipRoles(createClient()).then((result) => { if (mounted) setRoles(result.roles); });
    return () => { mounted = false; };
  }, []);
  return roles;
}
