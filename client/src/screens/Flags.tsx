import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import type { ClientListRow, FlagRow, Lookups } from "../contracts";
import { chiWhen, chipColor, exportCsv } from "../screenUtil";

type ToastFn = (m: string) => void;

export function Flags({ toast, admin }: { toast: ToastFn; admin: boolean }) {
  const nav = useNavigate();
  const [state, setState] = useState<"open" | "archived">("open");
  const [levelId, setLevelId] = useState("");
  const [clientId, setClientId] = useState("");
  const [rows, setRows] = useState<FlagRow[] | null>(null);
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [clients, setClients] = useState<ClientListRow[]>([]);
  const [createOn, setCreateOn] = useState(false);
  const [form, setForm] = useState({ clientId: "", levelId: "", body: "", personId: "" });

  const load = () => {
    const qs = new URLSearchParams({ state });
    if (levelId) qs.set("levelId", levelId);
    if (clientId) qs.set("clientId", clientId);
    api<FlagRow[]>("/api/flags?" + qs)
      .then(setRows)
      .catch(e => toast((e as Error).message));
  };

  useEffect(() => {
    api<Lookups>("/api/lookups").then(l => {
      setLookups(l);
      if (l.flagLevels[0]) setForm(f => ({ ...f, levelId: f.levelId || l.flagLevels[0].id }));
    }).catch(() => {});
    api<ClientListRow[]>("/api/clients").then(list => {
      setClients(list);
      if (list[0]) setForm(f => ({ ...f, clientId: f.clientId || list[0].id }));
    }).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [state, levelId, clientId]);

  const archive = async (id: string) => {
    try {
      await api(`/api/flags/${id}/archive`, { method: "POST" });
      toast("Archived · deletes in 90 days");
      load();
    } catch (e) { toast((e as Error).message); }
  };

  const restore = async (id: string) => {
    try {
      await api(`/api/flags/${id}/restore`, { method: "POST" });
      toast("Restored to open flags");
      load();
    } catch (e) { toast((e as Error).message); }
  };

  const create = async () => {
    if (!form.clientId || !form.levelId || !form.body.trim()) { toast("Client, level, and body needed"); return; }
    try {
      await api("/api/flags", { method: "POST", body: JSON.stringify({
        clientId: form.clientId, levelId: form.levelId, body: form.body, personId: form.personId || null
      }) });
      toast("Flag added");
      setCreateOn(false);
      setForm(f => ({ ...f, body: "", personId: "" }));
      setState("open");
      load();
    } catch (e) { toast((e as Error).message); }
  };

  return (
    <section>
      <div className="h">
        <div>
          <h1>Flags</h1>
          <p>Newest first. Archive is a person-by-person call — not automatic by age.</p>
        </div>
        <button className="btn p" onClick={() => setCreateOn(v => !v)}>+ New flag</button>
      </div>
      <div className="tools">
        <select className="sel" value={state} onChange={e => setState(e.target.value as "open" | "archived")}>
          <option value="open">Open</option>
          <option value="archived">Archived</option>
        </select>
        <select className="sel" value={levelId} onChange={e => setLevelId(e.target.value)}>
          <option value="">All levels</option>
          {(lookups?.flagLevels || []).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select className="sel" value={clientId} onChange={e => setClientId(e.target.value)}>
          <option value="">All clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {admin && <button className="btn admin-only" onClick={() => exportCsv("/api/admin/export/flags", toast)}>Export flags</button>}
      </div>

      {createOn && (
        <div className="card mod" style={{ marginBottom: 14 }}>
          <div className="mod-h"><h2>New flag</h2></div>
          <div className="tools">
            <select className="sel" value={form.clientId} onChange={e => setForm({ ...form, clientId: e.target.value })}>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="sel" value={form.levelId} onChange={e => setForm({ ...form, levelId: e.target.value })}>
              {(lookups?.flagLevels || []).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <textarea className="compose" placeholder="What the shop needs to see" value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} />
          <button className="btn p" style={{ marginTop: 10 }} onClick={create}>Save flag</button>
        </div>
      )}

      {state === "open" && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>Entered</th><th>Level</th><th>On</th><th>Flag</th><th>Client</th><th>By</th><th></th>
              </tr></thead>
              <tbody>
                {!rows && <tr><td colSpan={7} className="muted">Loading flags…</td></tr>}
                {rows && rows.length === 0 && <tr><td colSpan={7} className="muted">No open flags.</td></tr>}
                {rows?.map(f => (
                  <tr key={f.id}>
                    <td className="muted">{chiWhen(f.createdAt)}</td>
                    <td><span className={"chip " + chipColor(f.color, f.level)}>{f.level || "Flag"}</span></td>
                    <td>{f.on}</td>
                    <td className="go" onClick={() => nav("/clients/" + f.clientId)}>{f.body}</td>
                    <td><Link to={"/clients/" + f.clientId}>{f.client}</Link></td>
                    <td>{f.createdBy ? <Link to="/team">{f.createdBy}</Link> : "—"}</td>
                    <td><button className="btn s" onClick={() => archive(f.id)}>Archive</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {state === "archived" && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>Level</th><th>On</th><th>Flag</th><th>Client</th><th>Deletes</th><th></th>
              </tr></thead>
              <tbody>
                {!rows && <tr><td colSpan={6} className="muted">Loading archive…</td></tr>}
                {rows && rows.length === 0 && <tr><td colSpan={6} className="muted">Nothing in the 90-day hold.</td></tr>}
                {rows?.map(f => (
                  <tr key={f.id}>
                    <td><span className={"chip " + chipColor(f.color, f.level)}>{f.level || "Flag"}</span></td>
                    <td>{f.on}</td>
                    <td>{f.body}</td>
                    <td><Link to={"/clients/" + f.clientId}>{f.client}</Link></td>
                    <td className="muted">{f.daysLeft != null ? `${f.daysLeft} days left` : "—"}</td>
                    <td><button className="btn s" onClick={() => restore(f.id)}>Restore</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ padding: "10px 12px" }}>
            Archived flags are hidden on the client file. After 90 days they are deleted and cannot be restored. No immediate delete — archive first.
          </p>
        </div>
      )}
    </section>
  );
}
