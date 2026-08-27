"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ROLES } from "@/lib/roles";
import { hasSupabaseConfig } from "@/lib/supabase/config";

type Member = {
  id: string;
  role: string;
  name: string;
  contact_email: string | null;
  bio: string | null;
  photo_url: string | null;
};

export default function AdminLeadership() {
  const [members, setMembers] = useState<Member[]>([]);
  const [role, setRole] = useState<string>(ROLES[1].slug);
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [bio, setBio] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const [loading, setLoading] = useState(true);
  const roleId = useId();
  const nameId = useId();
  const contactEmailId = useId();
  const bioId = useId();
  const photoId = useId();

  const selectedRole = useMemo(() => ROLES.find((r) => r.slug === role), [role]);
  const currentMember = useMemo(() => members.find((member) => member.role === role) ?? null, [members, role]);

  async function load() {
    setLoading(true);
    if (!hasSupabaseConfig()) {
      setMembers([]);
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase.from("leadership_members").select("*");
    setMembers((data as Member[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

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
    if (!name.trim()) return;
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

        photoUrl = supabase.storage.from("leadership-photos").getPublicUrl(objectPath).data.publicUrl;
      }

      const { error: saveError } = await supabase.from("leadership_members").upsert(
        {
          role,
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
    const supabase = createClient();
    await supabase.from("leadership_members").delete().eq("id", id);
    load();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-sm bg-paper p-5 ring-1 ring-forest/10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Leadership Board</p>
            <h3 className="mt-2 font-display text-2xl text-forest">Seat editor</h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-graphite/70">
              Fill the seat and add a photo from your computer.
            </p>
          </div>
          <p className="text-sm text-graphite/60">{members.length} filled seat{members.length === 1 ? "" : "s"}</p>
        </div>

        <form onSubmit={fillSeat} className="mt-5 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={roleId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70">
              Role
            </label>
            <select
              id={roleId}
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="mt-2 block w-full rounded-sm border border-forest/15 bg-paper px-3 py-2 text-sm"
            >
              {ROLES.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-graphite/45">
              {selectedRole ? selectedRole.label : "Choose a seat to update."}
            </p>
          </div>
          <div>
            <label htmlFor={nameId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70">
              Name
            </label>
            <input
              id={nameId}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 block w-full rounded-sm border border-forest/15 bg-paper px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label
              htmlFor={contactEmailId}
              className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70"
            >
              Contact Email
            </label>
            <input
              id={contactEmailId}
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="mt-2 block w-full rounded-sm border border-forest/15 bg-paper px-3 py-2 text-sm"
              placeholder="name@lvjusd.org"
            />
          </div>
          <div>
            <label htmlFor={bioId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70">
              Bio (optional)
            </label>
            <input
              id={bioId}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="mt-2 block w-full rounded-sm border border-forest/15 bg-paper px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={photoId} className="font-mono text-xs uppercase tracking-[0.15em] text-graphite/70">
              Leadership Photo
            </label>
            <div className="mt-2 grid gap-4 rounded-sm border border-dashed border-forest/15 bg-paper p-4 sm:grid-cols-[1fr_180px] sm:items-center">
              <div>
                <input
                  id={photoId}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    setPhotoError("");
                    setPhotoFile(e.target.files?.[0] ?? null);
                  }}
                  className="block w-full text-sm text-graphite/70 file:mr-4 file:rounded-sm file:border-0 file:bg-forest file:px-4 file:py-2 file:font-mono file:text-xs file:uppercase file:tracking-[0.15em] file:text-gold hover:file:bg-forestdeep"
                />
                <p className="mt-2 text-xs leading-relaxed text-graphite/55">
                  Upload directly from your computer. The image is stored in the photo bucket and
                  attached to this seat.
                </p>
                {photoFile && (
                  <p className="mt-1 text-xs text-graphite/70">
                    Selected: <span className="font-medium">{photoFile.name}</span>
                  </p>
                )}
                {photoError && <p className="mt-2 text-xs text-red-700">{photoError}</p>}
              </div>
              <div className="flex justify-start sm:justify-end">
                <div className="flex h-36 w-36 items-center justify-center overflow-hidden rounded-sm border border-forest/10 bg-forest/[0.03]">
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
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">
                        Preview
                      </p>
                      <p className="mt-1 text-sm text-graphite/60">No photo selected yet</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="sm:col-span-2">
                {currentMember?.photo_url && !photoFile ? (
                  <button
                    type="button"
                    onClick={clearPhoto}
                    disabled={removingPhoto}
                    className="inline-flex min-h-11 items-center rounded-sm border border-red-700/20 px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {removingPhoto ? "Removing photo..." : "Remove current photo"}
                  </button>
                ) : (
                  <p className="text-xs text-graphite/45">
                    Upload a new image to replace the current one, or remove the existing photo to
                    return the seat to text only.
                  </p>
                )}
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-sm bg-forest px-4 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-gold transition hover:bg-forestdeep disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2"
          >
            {saving ? "Saving..." : "Fill / Update Seat"}
          </button>
        </form>
      </section>

      <div className="space-y-3">
        {loading && <p className="text-sm text-graphite/50">Loading...</p>}
        {members.map((m) => (
          <div key={m.id} className="rounded-sm bg-forest/[0.03] p-4 ring-1 ring-forest/10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-forest/10 bg-paper">
                  {m.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.photo_url} alt={m.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-mono text-xs uppercase tracking-[0.15em] text-gold">
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
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-gold">{m.role}</p>
                  <p className="font-medium text-graphite">{m.name}</p>
                  {m.contact_email && <p className="text-xs text-graphite/60">{m.contact_email}</p>}
                </div>
              </div>
              <button
                onClick={() => vacateSeat(m.id)}
                className="inline-flex min-h-11 items-center font-mono text-xs uppercase tracking-[0.15em] text-red-700 hover:underline"
              >
                Vacate
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
