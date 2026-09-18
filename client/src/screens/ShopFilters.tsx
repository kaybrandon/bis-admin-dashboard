import { useEffect, useMemo, useState } from "react";
import { api, token, type User } from "../api";
import { exportCsv, mention } from "../screenUtil";

type ToastFn = (m: string) => void;

function qs(params: Record<string, string | undefined>) {
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v?.trim()) u.set(k, v.trim()); });
  const s = u.toString();
  return s ? "?" + s : "";
}

function RangeFields({ from, to, setFrom, setTo }: {
  from: string; to: string; setFrom: (v: string) => void; setTo: (v: string) => void;
}) {
  return (
    <>
      <label className="filter-lbl"><span>From</span>
        <input className="sel" type="date" value={from} onChange={e => setFrom(e.target.value)} aria-label="From" />
      </label>
      <label className="filter-lbl"><span>To</span>
        <input className="sel" type="date" value={to} onChange={e => setTo(e.target.value)} aria-label="To" />
      </label>
    </>
  );
}

function useSort<T>(rows: T[], value: (row: T, key: string) => string | number) {
  const [sort, setSort] = useState<string | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((a, b) => {
      const av = value(a, sort);
      const bv = value(b, sort);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      const as = String(av ?? "").toLowerCase();
      const bs = String(bv ?? "").toLowerCase();
      return as < bs ? -dir : as > bs ? dir : 0;
    });
  }, [rows, sort, dir, value]);
  const th = (key: string, label: string) => (
    <th className="th-sort" onClick={() => { if (sort === key) setDir(d => d === 1 ? -1 : 1); else { setSort(key); setDir(1); } }}>
      {label}{sort === key ? (dir === 1 ? " ↑" : " ↓") : ""}
    </th>
  );
  return { sorted, th };
}

function fmtH(n: number) { return n ? `${Math.round(n)}h` : "—"; }

async function exportPdf(path: string, toast: ToastFn) {
  try {
    const res = await fetch(path, { headers: { Authorization: "Bearer " + token() } });
    if (res.status === 403) { toast("Admin only · export blocked"); return; }
    if (!res.ok) { toast("PDF failed"); return; }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "reports.pdf";
    a.click();
    toast("PDF started · admin");
  } catch { toast("PDF failed"); }
}

export function Time({ toast }: { user: User; setUser: (u: User) => void; toast: ToastFn }) {
  const [data, setData] = useState<any>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [notes, setNotes] = useState("");
  const load = () => api("/api/time" + qs({ from, to, q: notes })).then(setData);
  useEffect(() => { load(); }, [from, to, notes]);
  if (!data) return <p>Loading punches…</p>;
  return (
    <section>
      <div className="h"><div><h1>My Time</h1><p>Your punches. Clock in from the header — it lands here.</p></div></div>
      <div className="tools print-hide">
        <RangeFields from={from} to={to} setFrom={setFrom} setTo={setTo} />
        <label className="filter-lbl"><span>Search notes</span>
          <input className="sel" placeholder="Search notes" value={notes} onChange={e => setNotes(e.target.value)} aria-label="Search notes" />
        </label>
      </div>
      <div className="stats">
        <div className="stat"><span>Today</span><b>{data.todayHours}h</b></div>
        <div className="stat"><span>This week</span><b>{data.weekHours}h</b></div>
        <div className="stat"><span>Status</span><b style={{ fontSize: 18 }}>{data.open ? "In" : "Out"}</b></div>
        <div className="stat"><span>Workplace</span><b style={{ fontSize: 18 }}>{data.open?.workplace || "—"}</b></div>
      </div>
      <div className="card"><div className="table-wrap"><table>
        <thead><tr><th>When</th><th>In / Out</th><th>Where</th><th>Note</th><th></th></tr></thead>
        <tbody>
          {data.punches.length === 0 && <tr><td colSpan={5} className="muted">No punches match.</td></tr>}
          {data.punches.map((p: any) => (
            <tr key={p.id}>
              <td>{new Date(p.at).toLocaleString()}</td><td>{p.dir === "in" ? "In" : "Out"}</td>
              <td>{p.workplace}{p.destination ? " · " + p.destination : ""}</td>
              <td className="muted">{p.note || "—"}</td>
              <td><button className="btn s print-hide" onClick={async () => {
                const next = prompt("New time (local)", new Date(p.at).toISOString());
                if (!next) return;
                await api("/api/time/" + p.id, { method: "PUT", body: JSON.stringify({ at: next, reason: "edit" }) });
                toast("Changed · manager notified · audit written"); load();
              }}>Edit</button></td>
            </tr>
          ))}
        </tbody>
      </table></div></div>
    </section>
  );
}

export function Reports({ toast }: { toast: ToastFn }) {
  const [data, setData] = useState<any>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [name, setName] = useState("");
  const [dept, setDept] = useState("");
  const [who, setWho] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api<any>("/api/reports").then(d => {
      setFrom(d.from || "");
      setTo(d.to || "");
      setData(d);
      setReady(true);
    });
  }, []);
  useEffect(() => {
    if (!ready) return;
    api("/api/reports" + qs({ from, to })).then(setData);
  }, [from, to, ready]);

  const people = (data?.byPerson || []) as any[];
  const depts = useMemo(() => [...new Set(people.map(r => r.dept).filter(Boolean))].sort(), [people]);
  const filteredPeople = people.filter(r =>
    (!name.trim() || String(r.name || "").toLowerCase().includes(name.trim().toLowerCase())) &&
    (!dept || r.dept === dept)
  );
  const personVal = (r: any, key: string) => key === "name" || key === "dept" ? String(r[key] ?? "") : Number(r[key] ?? 0);
  const { sorted: sortedPeople, th: thP } = useSort(filteredPeople, personVal);

  const punches = ((data?.punches || []) as any[]).filter(p =>
    !who.trim() || String(p.who || "").toLowerCase().includes(who.trim().toLowerCase())
  );
  const punchVal = (p: any, key: string) => key === "at" ? new Date(p.at).getTime() : String(p[key] ?? "");
  const { sorted: sortedPunches, th: thK } = useSort(punches, punchVal);

  if (!data) return <p>Loading reports…</p>;
  const pdfPath = "/api/reports/pdf" + qs({ from, to });
  return (
    <section className="reports-page">
      <div className="h"><div><h1>Reports</h1><p>Admin · time for the whole shop</p></div>
        <div className="print-hide" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn p" onClick={() => exportPdf(pdfPath, toast)}>PDF</button>
          <button className="btn" onClick={() => exportCsv("/api/admin/export/clients", toast)}>Export</button>
        </div>
      </div>
      <div className="tools print-hide">
        <RangeFields from={from} to={to} setFrom={setFrom} setTo={setTo} />
        <label className="filter-lbl"><span>Name</span>
          <input className="sel" placeholder="Name" value={name} onChange={e => setName(e.target.value)} aria-label="Name" />
        </label>
        <label className="filter-lbl"><span>Dept</span>
          <select className="sel" value={dept} onChange={e => setDept(e.target.value)} aria-label="Dept">
            <option value="">All depts</option>
            {depts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
      </div>
      <div className="stats">
        <div className="stat"><span>Hours</span><b>{Math.round(data.totals.hours)}</b></div>
        <div className="stat"><span>Office</span><b>{Math.round(data.totals.office)}</b></div>
        <div className="stat"><span>Road</span><b>{Math.round(data.totals.road)}</b></div>
        <div className="stat"><span>Home</span><b>{Math.round(data.totals.home)}</b></div>
      </div>
      <div className="card" style={{ marginBottom: 14 }}><div className="table-wrap"><table>
        <thead><tr>
          {thP("name", "Name")}{thP("dept", "Dept")}{thP("office", "Office")}{thP("road", "Road")}{thP("home", "Home")}{thP("total", "Total")}
        </tr></thead>
        <tbody>
          {sortedPeople.length === 0 && <tr><td colSpan={6} className="muted">No rows match.</td></tr>}
          {sortedPeople.map((r: any) => <tr key={r.userId}><td><strong>{r.name}</strong></td><td>{r.dept}</td><td>{fmtH(r.office)}</td><td>{fmtH(r.road)}</td><td>{fmtH(r.home)}</td><td>{fmtH(r.total)}</td></tr>)}
        </tbody>
      </table></div></div>
      <div className="card">
        <div className="mod-h" style={{ padding: "12px 12px 0" }}>
          <h2>Punches</h2>
          <label className="filter-lbl print-hide"><span>Who</span>
            <input className="sel" placeholder="Who" value={who} onChange={e => setWho(e.target.value)} aria-label="Who" />
          </label>
        </div>
        <div className="table-wrap"><table>
          <thead><tr>
            {thK("who", "Who")}{thK("at", "When")}{thK("dir", "In / Out")}{thK("workplace", "Where")}{thK("note", "Note")}
          </tr></thead>
          <tbody>
            {sortedPunches.map((p: any, i: number) => <tr key={i}><td>{p.who}</td><td>{new Date(p.at).toLocaleString()}</td><td>{p.dir}</td><td>{p.workplace}</td><td className="muted">{p.note || p.destination || "—"}</td></tr>)}
          </tbody>
        </table></div>
      </div>
    </section>
  );
}

export function Audit({ toast }: { toast: ToastFn }) {
  const [rows, setRows] = useState<any[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [who, setWho] = useState("");
  const [did, setDid] = useState("");
  const [on, setOn] = useState("");

  const load = () => api<any[]>("/api/audit" + qs({ from, to, q: search, actor: who, action: did, objectType: on })).then(setRows);
  useEffect(() => { load(); }, [from, to, search, who, did, on]);

  const actions = useMemo(() => {
    const set = new Set(rows.map(r => r.action).filter(Boolean) as string[]);
    if (did) set.add(did);
    return [...set].sort();
  }, [rows, did]);
  const objects = useMemo(() => {
    const set = new Set(rows.map(r => r.objectType).filter(Boolean) as string[]);
    if (on) set.add(on);
    return [...set].sort();
  }, [rows, on]);
  const val = (a: any, key: string) => key === "createdAt" ? new Date(a.createdAt).getTime() : String(a[key] ?? "");
  const { sorted, th } = useSort(rows, val);

  return (
    <section>
      <div className="h"><div><h1>Audit</h1><p>Every change. Revert writes a new line — the log itself cannot be edited.</p></div>
        <button className="btn p print-hide" onClick={() => exportCsv("/api/admin/export/audit", toast)}>Export log</button></div>
      <div className="tools print-hide">
        <RangeFields from={from} to={to} setFrom={setFrom} setTo={setTo} />
        <label className="filter-lbl"><span>Search</span>
          <input className="sel" placeholder="Search" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search" />
        </label>
        <label className="filter-lbl"><span>Who</span>
          <input className="sel" placeholder="Who" value={who} onChange={e => setWho(e.target.value)} aria-label="Who" />
        </label>
        <label className="filter-lbl"><span>Did</span>
          <select className="sel" value={did} onChange={e => setDid(e.target.value)} aria-label="Did">
            <option value="">All</option>
            {actions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="filter-lbl"><span>On</span>
          <select className="sel" value={on} onChange={e => setOn(e.target.value)} aria-label="On">
            <option value="">All</option>
            {objects.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
      </div>
      <div className="card"><div className="table-wrap"><table>
        <thead><tr>
          {th("createdAt", "When")}{th("actor", "Who")}{th("action", "Did")}{th("objectType", "On")}<th></th>
        </tr></thead>
        <tbody>
          {sorted.length === 0 && <tr><td colSpan={5} className="muted">No audit lines match.</td></tr>}
          {sorted.map(a => (
            <tr key={a.id}>
              <td className="muted">{new Date(a.createdAt).toLocaleString()}</td>
              <td>{a.actor}</td><td>{a.action} · {a.objectType}</td><td>{a.clientId || a.objectType}</td>
              <td>{a.canRevert ? <button className="btn s" onClick={async () => {
                const reason = prompt("Reason for revert") || "revert";
                await api(`/api/audit/${a.id}/revert`, { method: "POST", body: JSON.stringify({ reason }) });
                toast("Reverted · new audit line written"); load();
              }}>Revert</button> : <span className="muted">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table></div></div>
      <p className="muted" style={{ marginTop: 10 }}>Vault passwords and API token values are never stored in this log.</p>
    </section>
  );
}

export function KudosPage({ toast }: { toast: ToastFn }) {
  const [data, setData] = useState<any>(null);
  const [team, setTeam] = useState<any[]>([]);
  const [to, setTo] = useState("");
  const [why, setWhy] = useState("");
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const load = () => api("/api/kudos" + qs({ name, from, to: until })).then(setData);
  useEffect(() => { api<any[]>("/api/team").then(t => { setTeam(t); setTo(t[0]?.id); }); }, []);
  useEffect(() => { load(); }, [name, from, until]);
  if (!data) return <p>Loading kudos…</p>;
  return (
    <section>
      <div className="h"><div><h1>Kudos</h1><p>One person. One thing they did. Counted by week, summed by month.</p></div></div>
      <div className="tools print-hide">
        <label className="filter-lbl"><span>Name</span>
          <select className="sel" value={name} onChange={e => setName(e.target.value)} aria-label="Name">
            <option value="">All names</option>
            {team.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
          </select>
        </label>
        <RangeFields from={from} to={until} setFrom={setFrom} setTo={setUntil} />
      </div>
      <div className="card mod" style={{ marginBottom: 14 }}>
        <div className="mod-h"><h2>Give kudos</h2></div>
        <label className="muted">To</label>
        <select className="sel" style={{ width: "100%", maxWidth: 320, margin: "6px 0 12px" }} value={to} onChange={e => setTo(e.target.value)}>
          {team.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <label className="muted">One thing they did</label>
        <input className="sel" style={{ width: "100%", margin: "6px 0 12px" }} value={why} onChange={e => setWhy(e.target.value)} placeholder="Owned the Northstar on-site" />
        <button className="btn p" onClick={async () => {
          if (!why.trim()) { toast("Name the thing they did"); return; }
          await api("/api/kudos", { method: "POST", body: JSON.stringify({ toUserId: to, body: why }) });
          toast("Star given"); setWhy(""); load();
        }}>Give a star</button>
      </div>
      <div className="stats">{data.totals.map((t: any) => <div className="stat" key={t.id}><span>{t.name.split(" ")[0]} · week</span><b>{t.week} ★</b></div>)}</div>
      <div className="modules">
        <div className="card mod span2">
          <div className="mod-h"><h2>This week</h2><span className="muted">Month is the sum of weeks</span></div>
          {data.totals.map((t: any) => (
            <div className="row" key={t.id}><div className="who"><div className="av" style={{ background: t.avatarColor }}>{t.initials}</div>
              <div><strong>{t.name}</strong><div className="muted">{t.week} this week · {t.month} this month</div></div></div><span>{t.month} ★</span></div>
          ))}
        </div>
        <div className="card mod span2">
          <div className="mod-h"><h2>Latest</h2></div>
          {data.latest.length === 0 && <p className="muted">No kudos match.</p>}
          {data.latest.map((k: any) => <div className="row" key={k.id}><div><strong>{k.from} → {k.to}</strong><div className="muted">{k.body}</div></div><span>★</span></div>)}
        </div>
      </div>
      <p className="muted" style={{ marginTop: 10 }}>One star per note. Name the person, name the thing.</p>
    </section>
  );
}

export function Mentions() {
  const [rows, setRows] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  useEffect(() => { api<any[]>("/api/team").then(setTeam).catch(() => {}); }, []);
  useEffect(() => { api<any[]>("/api/mentions" + qs({ name, from, to })).then(setRows); }, [name, from, to]);
  return (
    <section>
      <div className="h"><div><h1>@Mentions</h1><p>Everywhere someone tagged you — notes, #Post It, kudos, flags, the board.</p></div></div>
      <div className="tools print-hide">
        <label className="filter-lbl"><span>Name</span>
          <select className="sel" value={name} onChange={e => setName(e.target.value)} aria-label="Name">
            <option value="">Tagged me</option>
            {team.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
          </select>
        </label>
        <RangeFields from={from} to={to} setFrom={setFrom} setTo={setTo} />
      </div>
      <div className="card"><div className="table-wrap"><table>
        <thead><tr><th>When</th><th>Name</th><th>Where</th><th>Said</th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={4} className="muted">No mentions match.</td></tr>}
          {rows.map(m => <tr key={m.id}><td className="muted">{new Date(m.createdAt).toLocaleString()}</td><td>{m.name || "—"}</td><td>{m.sourceType}</td><td>{mention(m.snippet || "")}</td></tr>)}
        </tbody>
      </table></div></div>
    </section>
  );
}
