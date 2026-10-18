import { redirect } from "next/navigation";

// Compatibility for saved links: all PEET work now lives inside officer tasks.
export default async function LegacyPeetPage({ searchParams }: { searchParams: Promise<{ task?: string }> }) {
  const { task } = await searchParams;
  const params = new URLSearchParams({ view: "tasks" });
  if (task && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(task)) params.set("task", task);
  redirect(`/officerboard?${params}`);
}
