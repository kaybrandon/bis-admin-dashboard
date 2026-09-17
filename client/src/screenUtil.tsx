import { Link } from "react-router-dom";
import { token } from "./api";

const CHI = "America/Chicago";

export function hourWord(d = new Date()) {
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: CHI, hour: "numeric", hour12: false }).format(d));
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

export function chiWhen(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", { timeZone: CHI, weekday: "short", hour: "numeric", minute: "2-digit" });
}

export function chiStamp(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", { timeZone: CHI, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function monthYear(value?: string) {
  if (!value) return "—";
  const raw = value.length === 10 ? value + "T00:00:00" : value;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

export function host(url?: string) {
  if (!url) return "";
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "");
  }
}

export function telHref(phone?: string) {
  if (!phone) return undefined;
  return "tel:" + phone.replace(/[^\d+]/g, "");
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

export function bytes(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MB`;
  if (n >= 1000) return `${Math.round(n / 1000)} KB`;
  return `${n} B`;
}

export function fileKind(mime: string, kind?: string) {
  if (kind === "photo" || mime.startsWith("image/")) return "Photo";
  if (mime.includes("pdf")) return "PDF";
  if (mime.includes("word") || mime.includes("document")) return "Word";
  if (mime.includes("sheet") || mime.includes("excel")) return "Excel";
  return "File";
}

export function mention(text: string) {
  const parts = text.split(/(@[A-Za-z][A-Za-z0-9._-]*)/g);
  return parts.map((p, i) =>
    p.startsWith("@")
      ? <Link className="mention" key={i} to="/mentions">{p}</Link>
      : <span key={i}>{p}</span>
  );
}

export async function exportCsv(path: string, toast: (m: string) => void) {
  try {
    const res = await fetch(path, { headers: { Authorization: "Bearer " + token() } });
    if (res.status === 403) { toast("Admin only · export blocked"); return; }
    if (!res.ok) { toast("Export failed"); return; }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "admin-export.csv";
    a.click();
    toast("Export started · admin");
  } catch {
    toast("Export failed");
  }
}

export async function openAuthedFile(id: string, toast: (m: string) => void) {
  try {
    const res = await fetch("/files/" + id, { headers: { Authorization: "Bearer " + token() } });
    if (!res.ok) { toast("Could not open file"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
  } catch {
    toast("Could not open file");
  }
}

export function chipColor(color?: string, level?: string) {
  const c = (color || level || "").toLowerCase();
  if (c.includes("warn")) return "warn";
  if (c.includes("care")) return "care";
  if (c === "on" || c === "active") return "on";
  return "";
}
