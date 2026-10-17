"use client";

import controls from "@/components/workspace-controls.module.css";
import LeadershipPhotoCropper from "@/components/admin/LeadershipPhotoCropper";
import { useEffect, useId, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_LEADERSHIP_ROLES, loadLeadershipRoles, type LeadershipRole } from "@/lib/leadership-roles";
import { getRoleLabel, ROLES } from "@/lib/roles";
import { hasSupabaseConfig } from "@/lib/supabase/config";

type Member = {
  id: string;
  role: string;
  name: string;
  contact_email: string | null;
  bio: string | null;
  photo_url: string | null;
  display_order: number;
};

type FormerMember = Member & {
  id: string;
  school_year: string;
};

export default function AdminLeadership() {
  const [roles, setRoles] = useState<LeadershipRole[]>(DEFAULT_LEADERSHIP_ROLES);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, string>>({});
  const [newRoleName, setNewRoleName] = useState("");
  const [roleError, setRoleError] = useState("");
  const [roleSaving, setRoleSaving] = useState(false);
  const [rolesReady, setRolesReady] = useState(false);
  const activeRoles = useMemo(() => roles.filter((item) => item.active), [roles]);
  const [members, setMembers] = useState<Member[]>([]);
  const [formerMembers, setFormerMembers] = useState<FormerMember[]>([]);
  const [role, setRole] = useState<string>(ROLES[1].slug);
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [bio, setBio] = useState("");
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const [retireYear, setRetireYear] = useState("2025-2026");
  const [formerRole, setFormerRole] = useState<string>(ROLES[1].slug);
  const [formerName, setFormerName] = useState("");
  const [formerEmail, setFormerEmail] = useState("");
  const [formerBio, setFormerBio] = useState("");
  const [formerYear, setFormerYear] = useState("2025-2026");
  const [loading, setLoading] = useState(true);
  const roleId = useId();
  const nameId = useId();
  const contactEmailId = useId();
  const bioId = useId();
  const photoId = useId();

  const selectedRole = useMemo(() => roles.find((r) => r.slug === role), [roles, role]);
  const currentMember = useMemo(() => members.find((member) => member.role === role) ?? null, [members, role]);

  useEffect(() => {
    setName(currentMember?.name ?? "");
    setContactEmail(currentMember?.contact_email ?? "");
    setBio(currentMember?.bio ?? "");
  }, [currentMember]);

  async function load() {
    setLoading(true);
    if (!hasSupabaseConfig()) {
      setMembers([]);
      setRoleError("Connect Supabase to manage leadership roles.");
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const [{ data }, { data: formerData }, roleResult] = await Promise.all([
      supabase.from("leadership_members").select("*"),
      supabase.from("leadership_history").select("*").order("school_year", { ascending: false }).order("display_order"),
      loadLeadershipRoles(supabase),
    ]);
    setRoles(roleResult.roles);
    setRolesReady(!roleResult.error);
    if (roleResult.error) setRoleError("Role management is unavailable. Apply the leadership_roles.sql database migration and reload.");
    setMembers((data as Member[]) ?? []);
    setFormerMembers((formerData as FormerMember[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!activeRoles.some((item) => item.slug === role)) setRole(activeRoles[0]?.slug ?? "");
    if (!activeRoles.some((item) => item.slug === formerRole)) setFormerRole(activeRoles[0]?.slug ?? "");
  }, [activeRoles, role, formerRole]);

  async function saveRole(event: React.FormEvent, slug?: string) {
    event.preventDefault();
    const label = (slug ? roleDrafts[slug] ?? roles.find((item) => item.slug === slug)?.label ?? "" : newRoleName).trim();
    if (!label || !rolesReady) return;
    if (activeRoles.some((item) => item.slug !== slug && item.label.toLowerCase() === label.toLowerCase())) {
      setRoleError("A role with this name already exists.");
      return;
    }
    setRoleError("");
    setRoleSaving(true);
    try {
      const supabase = createClient();
      const result = slug
        ? await supabase.from("leadership_roles").update({ label }).eq("slug", slug).select().single()
        : await supabase.from("leadership_roles").insert({
            slug: `role-${crypto.randomUUID()}`, label,
            display_order: Math.max(-1, ...roles.map((item) => item.display_order), ...members.map((item) => item.display_order)) + 1,
          }).select().single();
      if (result.error) throw result.error;
      if (!slug) setNewRoleName("");
      if (slug) setRoleDrafts((drafts) => {
        const next = { ...drafts };
        delete next[slug];
        return next;
      });
      await load();
    } catch (error) {
      setRoleError(error instanceof Error ? error.message : (error as { message?: string }).message ?? "Unable to save role.");
    } finally {
      setRoleSaving(false);
    }
  }

  async function removeRole(item: LeadershipRole) {
    if (!rolesReady || members.some((member) => member.role === item.slug)) return;
    setRoleError("");
    setRoleSaving(true);
    try {
      const { error } = await createClient().from("leadership_roles").update({ active: false }).eq("slug", item.slug).select().single();
      if (error) throw error;
      await load();
    } catch (error) {
      setRoleError(error instanceof Error ? error.message : (error as { message?: string }).message ?? "Unable to remove role.");
    } finally {
      setRoleSaving(false);
    }
  }

  useEffect(() => {
    if (!photoFile) {
      setSelectedPhotoPreview("");
      return;
    }

    const previewUrl = URL.createObjectURL(photoFile);
    setSelectedPhotoPreview(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [photoFile]);

  async function fillSeat(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !role || cropFile) return;
    setPhotoError("");
    setSaving(true);
    try {
      if (!hasSupabaseConfig()) {
        setName("");
        setContactEmail("");
        setBio("");
        setPhotoFile(null);
        return;
      }
      const supabase = createClient();
      let photoUrl: string | null = currentMember?.photo_url ?? null;

      if (photoFile) {
        const objectPath = `leadership/${role}`;
        const { error: uploadError } = await supabase.storage.from("leadership-photos").upload(objectPath, photoFile, {
          upsert: true,
          contentType: photoFile.type || undefined,
        });

        if (uploadError) {
          setPhotoError(uploadError.message);
          return;
        }

        photoUrl = supabase.storage.from("leadership-photos").getPublicUrl(objectPath).data.publicUrl + `?v=${Date.now()}`;
      }

      const { error: saveError } = await supabase.from("leadership_members").upsert(
        {
          role,
          display_order: currentMember?.display_order ?? (selectedRole?.display_order ?? 0),
          name: name.trim(),
          contact_email: contactEmail.trim() || null,
          bio: bio.trim() || null,
          photo_url: photoUrl,
        },
        { onConflict: "role" }
      );

      if (saveError) {
        setPhotoError(saveError.message);
        return;
      }

      setName("");
      setContactEmail("");
      setBio("");
      setPhotoFile(null);
      load();
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "Unable to save this seat. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function clearPhoto() {
    if (!hasSupabaseConfig()) return;
    setPhotoError("");
    setRemovingPhoto(true);
    try {
      const supabase = createClient();
      const objectPath = `leadership/${role}`;
      const { error: deleteError } = await supabase.storage.from("leadership-photos").remove([objectPath]);

      if (deleteError) {
        setPhotoError(deleteError.message);
        return;
      }

      const { error: saveError } = await supabase
        .from("leadership_members")
        .update({ photo_url: null })
        .eq("role", role);

      if (saveError) {
        setPhotoError(saveError.message);
        return;
      }

      setPhotoFile(null);
      load();
    } finally {
      setRemovingPhoto(false);
    }
  }

  async function vacateSeat(id: string) {
    if (!hasSupabaseConfig()) return;
    if (!window.confirm("Vacate this leadership seat? The current member will be removed without being added to the former leadership list. Choose Retire instead to preserve their record.")) return;
    const supabase = createClient();
    const { error } = await supabase.from("leadership_members").delete().eq("id", id);
    if (error) { setPhotoError("Couldn’t vacate this seat. Refresh and try again."); return; }
    load();
  }

  async function retireSeat(member: Member) {
    if (!hasSupabaseConfig()) return;
    const supabase = createClient();
    const { error: historyError } = await supabase.from("leadership_history").insert({
      role: member.role,
      name: member.name,
      contact_email: member.contact_email,
      bio: member.bio,
      photo_url: member.photo_url,
      school_year: retireYear,
      display_order: member.display_order,
    });

    if (historyError) {
      setPhotoError(historyError.message);
      return;
    }

    await supabase.from("leadership_members").delete().eq("id", member.id);
    load();
  }

  async function addFormerMember(event: React.FormEvent) {
    event.preventDefault();
    if (!formerName.trim() || !formerRole || !hasSupabaseConfig()) return;

    setSaving(true);
    const { error } = await createClient().from("leadership_history").insert({
      role: formerRole,
      name: formerName.trim(),
      contact_email: formerEmail.trim() || null,
      bio: formerBio.trim() || null,
      school_year: formerYear,
      display_order: (roles.find((item) => item.slug === formerRole)?.display_order ?? 0),
    });
    setSaving(false);

    if (error) {
      setPhotoError(error.message);
      return;
    }

    setFormerName("");
    setFormerEmail("");
    setFormerBio("");
    load();
  }

  async function moveMember(member: Member, direction: "up" | "down") {
    const ordered = [...members].sort((a, b) => a.display_order - b.display_order);
    const index = ordered.findIndex((item) => item.id === member.id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || swapIndex < 0 || swapIndex >= ordered.length || !hasSupabaseConfig()) return;

    const other = ordered[swapIndex];
    const supabase = createClient();
    await Promise.all([
      supabase.from("leadership_members").update({ display_order: other.display_order }).eq("id", member.id),
      supabase.from("leadership_members").update({ display_order: member.display_order }).eq("id", other.id),
    ]);
    load();
  }

  return (
    <div className="space-y-6">
      <section className="border-b border-forest/10 pb-6">
        <h3 className="text-xl font-semibold text-forest">Manage roles</h3>
        <p className="mt-2 text-sm text-graphite/80">Add a role, edit its name, or remove an empty role from the board. Retire or vacate a filled seat before removing its role. Archives and applications are preserved.</p>
        {roleError && <p role="alert" className="mt-3 text-sm text-red-700">{roleError}</p>}
        <fieldset disabled={loading || !rolesReady || roleSaving || saving} className="mt-4 space-y-3 disabled:opacity-60">
          {activeRoles.map((item) => (
            <form key={item.slug} onSubmit={(event) => saveRole(event, item.slug)} className="flex flex-wrap items-center gap-2">
              <input aria-label={`Name for ${item.label}`} required maxLength={100} value={roleDrafts[item.slug] ?? item.label} onChange={(event) => setRoleDrafts((drafts) => ({ ...drafts, [item.slug]: event.target.value }))} className="min-w-0 flex-1 rounded-[8px] border border-forest/65 bg-paper px-3 py-2 text-base" />
              <button type="submit" className={`${controls.control} min-h-11 rounded-[8px] border border-forest/15 px-3 text-sm text-forest`}>Save name</button>
              <button type="button" onClick={() => removeRole(item)} disabled={members.some((member) => member.role === item.slug)} title={members.some((member) => member.role === item.slug) ? "Retire or vacate this seat first" : undefined} aria-label={`Remove ${item.label}`} className={`${controls.control} min-h-11 px-3 text-sm text-red-700 disabled:opacity-40`}>Remove</button>
            </form>
          ))}
          {!activeRoles.length && <p className="text-sm text-graphite/80">No roles yet. Add a role to create a seat.</p>}
          <form onSubmit={(event) => saveRole(event)} className="flex flex-wrap gap-2 border-t border-forest/10 pt-3">
            <input aria-label="New role name" placeholder="New role name" required maxLength={100} value={newRoleName} onChange={(event) => setNewRoleName(event.target.value)} className="min-w-0 flex-1 rounded-[8px] border border-forest/65 bg-paper px-3 py-2 text-base" />
            <button type="submit" className={`${controls.control} min-h-11 rounded-[8px] bg-forest px-4 py-2 text-sm text-white`}>{roleSaving ? "Saving..." : "Add role"}</button>
          </form>
        </fieldset>
      </section>
      <section className="border-b border-forest/10 pb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="mt-2 text-xl font-semibold text-forest">Seat editor</h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-graphite/80">
              Fill the seat and add a photo from your computer.
            </p>
          </div>
          <p className="text-sm text-graphite/80">{members.length} filled seat{members.length === 1 ? "" : "s"}</p>
        </div>

        <form onSubmit={fillSeat} className="mt-5 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={roleId} className="text-sm font-medium text-graphite/80">
              Role
            </label>
            <select
              id={roleId}
              value={role}
              disabled={saving}
              onChange={(e) => {
                setRole(e.target.value);
                setPhotoFile(null);
                setCropFile(null);
                setPhotoError("");
              }}
              className="mt-2 block w-full rounded-[8px] border border-forest/65 bg-paper px-3 py-2 text-base"
            >
              {activeRoles.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-graphite/80">
              {selectedRole ? selectedRole.label : "Choose a seat to update."}
            </p>
          </div>
          <div>
            <label htmlFor={nameId} className="text-sm font-medium text-graphite/80">
              Name
            </label>
            <input
              id={nameId}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 block w-full rounded-[8px] border border-forest/65 bg-paper px-3 py-2 text-base"
            />
          </div>
          <div>
            <label
              htmlFor={contactEmailId}
              className="text-sm font-medium text-graphite/80"
            >
              Contact Email
            </label>
            <input
              id={contactEmailId}
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="mt-2 block w-full rounded-[8px] border border-forest/65 bg-paper px-3 py-2 text-base"
              placeholder="name@lvjusd.org" autoComplete="username"
            />
          </div>
          <div>
            <label htmlFor={bioId} className="text-sm font-medium text-graphite/80">
              Bio (optional)
            </label>
            <input
              id={bioId}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="mt-2 block w-full rounded-[8px] border border-forest/65 bg-paper px-3 py-2 text-base"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={photoId} className="text-sm font-medium text-graphite/80">
              Leadership Photo
            </label>
            <div className="mt-2 grid gap-4 rounded-[8px] border border-dashed border-forest/15 bg-paper p-4 sm:grid-cols-[1fr_180px] sm:items-center">
              <div>
                <input
                  id={photoId}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={saving}
                  onChange={(e) => {
                    setPhotoError("");
                    const file = e.target.files?.[0];
                    if (file) setCropFile(file);
                    e.target.value = "";
                  }}
                  className="block w-full text-base text-graphite/80 file:mr-4 file:rounded-[8px] file:border-0 file:bg-forest file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-forestdeep"
                />
                <p className="mt-2 text-xs leading-relaxed text-graphite/80">
                  Choose a photo, then crop it to a 4:5 portrait. Save the seat to publish your photo.
                </p>
                {photoFile && (
                  <p className="mt-1 text-xs text-graphite/80">
                    Selected: <span className="font-medium">{photoFile.name}</span>
                  </p>
                )}
                {photoError && <p className="mt-2 text-xs text-red-700" role="alert">{photoError}</p>}
              </div>
              <div className="flex justify-start sm:justify-end">
                <div className="flex aspect-[4/5] w-36 items-center justify-center overflow-hidden rounded-[8px] border border-forest/10 bg-forest/[0.03]">
                  {selectedPhotoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedPhotoPreview}
                      alt="Selected leadership photo preview"
                      className="h-full w-full object-cover"
                    />
                  ) : currentMember?.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentMember.photo_url}
                      alt={`Current ${selectedRole?.label ?? "role"} photo`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="px-4 text-center">
                      <p className="text-sm font-medium text-accent">
                        Preview
                      </p>
                      <p className="mt-1 text-sm text-graphite/80">No photo selected yet</p>
                    </div>
                  )}
                </div>
              </div>
              {cropFile && (
                <LeadershipPhotoCropper
                  key={`${role}-${cropFile.name}-${cropFile.lastModified}`}
                  file={cropFile}
                  onApply={(file) => { setPhotoFile(file); setCropFile(null); }}
                  onCancel={() => setCropFile(null)}
                />
              )}
              <div className="sm:col-span-2">
                {currentMember?.photo_url && !photoFile ? (
                  <button
                    type="button"
                    onClick={clearPhoto}
                    disabled={removingPhoto || saving || !!cropFile}
                    className={`${controls.control} inline-flex min-h-11 items-center rounded-[8px] border border-red-700/20 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {removingPhoto ? "Removing photo..." : "Remove current photo"}
                  </button>
                ) : (
                  <p className="text-xs text-graphite/80">
                    Upload a new image to replace the current one, or remove the existing photo to
                    return the seat to text only.
                  </p>
                )}
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={saving || loading || roleSaving || !!cropFile || activeRoles.length === 0}
            className={`${controls.control} rounded-[8px] bg-forest px-4 py-2.5 text-sm font-medium text-white transition hover:bg-forestdeep disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2`}
          >
            {saving ? "Saving..." : "Fill / Update Seat"}
          </button>
        </form>
      </section>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 border-t border-forest/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-accent">Current board</p>
            <p className="mt-1 text-sm text-graphite/80">Retiring a member preserves them on the public leadership archive.</p>
          </div>
          <label className="text-sm text-graphite/80">
            School year
            <select value={retireYear} onChange={(event) => setRetireYear(event.target.value)} className="mt-1 block min-h-10 rounded-[8px] border border-forest/65 bg-paper px-3 py-2 text-base">
              <option>2025-2026</option>
              <option>2026-2027</option>
              <option>2027-2028</option>
            </select>
          </label>
        </div>
        {loading && <p className="text-sm text-graphite/80" role="status">Loading...</p>}
        {[...members].sort((a, b) => a.display_order - b.display_order).map((m, index, orderedMembers) => (
          <div key={m.id} className="border-t border-forest/10 pt-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex aspect-[4/5] w-14 shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-forest/10 bg-paper">
                  {m.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.photo_url} alt={m.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-sm font-medium text-accent">
                      {m.name
                        .split(" ")
                        .filter(Boolean)
                        .map((part) => part[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-accent">{getRoleLabel(m.role, roles)}</p>
                  <p className="font-medium text-graphite">{m.name}</p>
                  {m.contact_email && <p className="text-xs text-graphite/80">{m.contact_email}</p>}
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => moveMember(m, "up")} disabled={index === 0} className={`${controls.control} rounded-[8px] border border-forest/15 px-2 py-1 text-sm text-forest hover:bg-paper disabled:opacity-30`} aria-label={`Move ${m.name} up`}>↑</button>
                  <button type="button" onClick={() => moveMember(m, "down")} disabled={index === orderedMembers.length - 1} className={`${controls.control} rounded-[8px] border border-forest/15 px-2 py-1 text-sm text-forest hover:bg-paper disabled:opacity-30`} aria-label={`Move ${m.name} down`}>↓</button>
                </div>
                <button
                  type="button"
                  onClick={() => vacateSeat(m.id)}
                  className={`${controls.control} inline-flex min-h-11 items-center text-sm font-medium text-red-700 hover:underline`}
                >
                  Vacate
                </button>
                <button
                  type="button"
                  onClick={() => retireSeat(m)}
                  className={`${controls.control} inline-flex min-h-11 items-center rounded-[8px] border border-forest/15 px-3 text-sm font-medium text-forest transition hover:bg-paper`}
                >
                  Retire
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {formerMembers.length > 0 && (
        <section className="border-t border-forest/10 pt-6">
          <p className="text-sm font-medium text-accent">Former Leadership</p>
          <h3 className="mt-2 text-xl font-semibold text-forest">Leadership archive</h3>
          <div className="mt-4 space-y-5">
            {Array.from(new Set(formerMembers.map((member) => member.school_year))).map((schoolYear) => (
              <div key={schoolYear}>
                <h4 className="font-display text-lg text-forest">{schoolYear}</h4>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {formerMembers.filter((member) => member.school_year === schoolYear).map((member) => (
                    <div key={member.id} className="rounded-[8px] bg-forest/[0.03] px-4 py-3 text-sm text-graphite/80">
                      <span className="font-medium text-forest">{member.name}</span> · {getRoleLabel(member.role, roles)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="border-t border-forest/10 pt-6">
        <p className="text-sm font-medium text-accent">Archive entry</p>
        <h3 className="mt-2 text-xl font-semibold text-forest">Add former team member</h3>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-graphite/80">
          Add someone from an earlier leadership team without filling a current seat first.
        </p>
        <form onSubmit={addFormerMember} className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-graphite/80">
            School year
            <select value={formerYear} onChange={(event) => setFormerYear(event.target.value)} className="mt-2 block w-full rounded-[8px] border border-forest/65 bg-paper px-3 py-2 text-base">
              <option>2024-2025</option>
              <option>2025-2026</option>
              <option>2026-2027</option>
              <option>2027-2028</option>
            </select>
          </label>
          <label className="text-sm text-graphite/80">
            Role
            <select value={formerRole} onChange={(event) => setFormerRole(event.target.value)} className="mt-2 block w-full rounded-[8px] border border-forest/65 bg-paper px-3 py-2 text-base">
              {activeRoles.map((item) => <option key={item.slug} value={item.slug}>{item.label}</option>)}
            </select>
          </label>
          <label className="text-sm text-graphite/80">
            Name
            <input required value={formerName} onChange={(event) => setFormerName(event.target.value)} className="mt-2 block w-full rounded-[8px] border border-forest/65 bg-paper px-3 py-2 text-base" />
          </label>
          <label className="text-sm text-graphite/80">
            Contact email (optional)
            <input type="email" value={formerEmail} onChange={(event) => setFormerEmail(event.target.value)} className="mt-2 block w-full rounded-[8px] border border-forest/65 bg-paper px-3 py-2 text-base" autoComplete="username" />
          </label>
          <label className="text-sm text-graphite/80 sm:col-span-2">
            Bio (optional)
            <input value={formerBio} onChange={(event) => setFormerBio(event.target.value)} className="mt-2 block w-full rounded-[8px] border border-forest/65 bg-paper px-3 py-2 text-base" />
          </label>
          <button type="submit" disabled={saving || loading || roleSaving || activeRoles.length === 0} className={`${controls.control} rounded-[8px] bg-forest px-4 py-2.5 text-sm font-medium text-white transition hover:bg-forestdeep disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2`}>
            {saving ? "Adding..." : "Add Former Member"}
          </button>
        </form>
      </section>
    </div>
  );
}
