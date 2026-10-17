import RouteLoading from "@/components/RouteLoading";

export default function AdminLoading({ detail = false }: { detail?: boolean }) {
  return <RouteLoading label={detail ? "Loading application…" : "Loading admin page…"} />;
}
