import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import type { ClientFile as ClientFileData, ClientListRow, Lookups } from "../contracts";
import { bytes, chipColor, exportCsv, fileKind, host, initials, mention, monthYear, openAuthedFile, telHref, chiWhen } from "../screenUtil";

type ToastFn = (m: string) => void;

export function Clients({ toast, admin }: { toast: ToastFn; admin: boolean }) {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const qParam = params.get("q") || "";
  const [rows, setRows] = useState<ClientListRow[] | null>(null);
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [industry, setIndustry] = useState("");
  const [county, setCounty] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState(qParam);
  const [sort, setSort] = useState<keyof ClientListRow>("name");
  const [dir, setDir] = useState<1 | -1>(1);
  const [createOn, setCreateOn] = useState(false);
  const [form, setForm] = useState({ name: "", industry: "", status: "Active", county: "", businessPhone: "", businessEmail: "", website: "" });

  const load = () => {
    const qs = new URLSearchParams();
    if (industry) qs.set("industry", industry);
    if (county) qs.set("county", county);
    if (status) qs.set("status", status);
    if (qParam.trim()) qs.set("q", qParam.trim());
    api<ClientListRow[]>("/api/clients" + (qs.toString() ? "?" + qs : ""))
      .then(setRows)
      .catch(e => toast((e as Error).message));
  };

  useEffect(() => { api<Lookups>("/api/lookups").then(setLookups).catch(() => {}); }, []);
  useEffect(() => { setQ(qParam); }, [qParam]);
  useEffect(() => { load(); }, [industry, county, status, qParam]);

  const industries = useMemo(() => {
    const set = new Set((rows || []).map(r => r.industry).filter(Boolean) as string[]);
    return [...set].sort();
  }, [rows]);

  const sorted = useMemo(() => {
    if (!rows) return [];
    return [...rows].sort((a, b) => {
      const av = String(a[sort] ?? "").toLowerCase();
      const bv = String(b[sort] ?? "").toLowerCase();
      return av < bv ? -dir : av > bv ? dir : 0;
    });
  }, [rows, sort, dir]);

  const th = (key: keyof ClientListRow, label: string) => (
    <th className="th-sort" onClick={() => { if (sort === key) setDir(d => d === 1 ? -1 : 1); else { setSort(key); setDir(1); } }}>{label}</th>
  );

  const create = async () => {
    if (!form.name.trim()) { toast("Name the client"); return; }
    try {
      const r = await api<{ id: string }>("/api/clients", { method: "POST", body: JSON.stringify({
        name: form.name, industry: form.industry || undefined, status: form.status || "Active",
        county: form.county || undefined, businessPhone: form.businessPhone || undefined,
        businessEmail: form.businessEmail || undefined, website: form.website || undefined
      }) });
      toast("Client added");
      setCreateOn(false);
      nav("/clients/" + r.id);
    } catch (e) { toast((e as Error).message); }
  };

  return (
    <section>
      <div className="h">
        <div>
          <h1>Clients</h1>
          <p>Every portfolio BIS keeps</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn p" onClick={() => setCreateOn(v => !v)}>+ New client</button>
        </div>
      </div>
      <div className="tools">
        <select className="sel" value={industry} onChange={e => setIndustry(e.target.value)}>
          <option value="">All industries</option>
          {industries.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
        <select className="sel" value={county} onChange={e => setCounty(e.target.value)}>
          <option value="">All counties</option>
          {(lookups?.counties || ["Denton", "Dallas", "Tarrant", "Collin"]).map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="sel" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="Active">Active</option>
          <option value="Prospect">Prospect</option>
        </select>
        <input className="sel" placeholder="Search name, people, address" value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { nav("/clients?q=" + encodeURIComponent(q)); load(); } }} />
        {admin && <button className="btn admin-only" onClick={() => exportCsv("/api/admin/export/clients", toast)}>Export</button>}
      </div>
      {createOn && (
        <div className="card mod" style={{ marginBottom: 14 }}>
          <div className="mod-h"><h2>New client</h2></div>
          <div className="form-grid">
            <input className="sel" placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <input className="sel" placeholder="Industry" value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} />
            <select className="sel" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option>Active</option><option>Prospect</option>
            </select>
            <select className="sel" value={form.county} onChange={e => setForm({ ...form, county: e.target.value })}>
              <option value="">County</option>
              {(lookups?.counties || []).map(c => <option key={c}>{c}</option>)}
            </select>
            <input className="sel" placeholder="Business phone" value={form.businessPhone} onChange={e => setForm({ ...form, businessPhone: e.target.value })} />
            <input className="sel" placeholder="Business email" value={form.businessEmail} onChange={e => setForm({ ...form, businessEmail: e.target.value })} />
            <input className="sel" placeholder="Website" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} />
          </div>
          <button className="btn p" style={{ marginTop: 10 }} onClick={create}>Save client</button>
        </div>
      )}
      <div className="card"><div className="table-wrap">
        <table>
          <thead><tr>
            {th("name", "Client")}
            {th("primary", "Primary")}
            {th("address", "Address")}
            {th("county", "County")}
            {th("contractEnd", "Contract end")}
            {th("status", "Status")}
          </tr></thead>
          <tbody>
            {!rows && <tr><td colSpan={6} className="muted">Loading clients…</td></tr>}
            {rows && sorted.length === 0 && <tr><td colSpan={6} className="muted">No clients match.</td></tr>}
            {sorted.map(c => (
              <tr className="go" key={c.id} onClick={() => nav("/clients/" + c.id)}>
                <td><strong>{c.name}</strong></td>
                <td>{c.primary || "—"}</td>
                <td>{c.address || "—"}</td>
                <td>{c.county || "—"}</td>
                <td>{monthYear(c.contractEnd)}</td>
                <td><span className={"chip" + (c.status === "Active" ? " on" : "")}>{c.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div></div>
    </section>
  );
}

export function ClientFile({ toast }: { toast?: ToastFn }) {
  const { id } = useParams();
  const show = toast || (() => {});
  const [file, setFile] = useState<ClientFileData | null>(null);
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [err, setErr] = useState("");
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [flagOn, setFlagOn] = useState(false);
  const [personOn, setPersonOn] = useState(false);
  const [addrOn, setAddrOn] = useState(false);
  const [vaultOn, setVaultOn] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [flag, setFlag] = useState({ levelId: "", body: "", personId: "" });
  const [person, setPerson] = useState({ name: "", title: "", department: "", email: "", phone: "", pinned: false, primary: false });
  const [addr, setAddr] = useState({ label: "", line1: "", city: "", state: "TX", zip: "", county: "", hours: "", isPrimary: false, phone: "" });
  const [vault, setVault] = useState({ department: "IT", title: "", username: "", secret: "", url: "", note: "" });

  const load = () => {
    if (!id) return;
    api<ClientFileData>("/api/clients/" + id)
      .then(setFile)
      .catch(e => setErr((e as Error).message));
  };

  useEffect(() => { load(); }, [id]);
  useEffect(() => { api<Lookups>("/api/lookups").then(l => {
    setLookups(l);
    if (l.flagLevels[0]) setFlag(f => ({ ...f, levelId: f.levelId || l.flagLevels[0].id }));
    if (l.departments[0]) setVault(v => ({ ...v, department: v.department || l.departments[0].name }));
  }).catch(() => {}); }, []);

  if (err) return <p className="err">{err}</p>;
  if (!file) return <p>Loading client file…</p>;

  const biz = file.business || {};
  const call = biz.call || file.businessPhone;
  const email = biz.email || file.businessEmail;
  const website = biz.website || file.website;
  const map = biz.map;
  const mapLabel = biz.mapLabel || "Map";
  const careOn = new Set(file.flags.filter(f => (f.color || f.level || "").toLowerCase().includes("care")).map(f => f.on));
  const pinned = file.people.filter(p => p.pinned);
  const depts = unique(file.people.map(p => p.department || "People"));
  const vaultDepts = unique(file.vault.map(v => v.department || "Vault"));
  const contract = file.customFields && typeof file.customFields["Contract end"] === "string"
    ? String(file.customFields["Contract end"]) : undefined;

  const reveal = async (credId: string) => {
    try {
      const r = await api<{ secret: string }>(`/api/clients/${file.id}/vault/${credId}/reveal`, { method: "POST" });
      setRevealed(s => ({ ...s, [credId]: r.secret }));
      show("Revealed · noted");
      window.setTimeout(() => setRevealed(s => {
        const next = { ...s };
        delete next[credId];
        return next;
      }), 30_000);
    } catch (e) { show((e as Error).message); }
  };

  const copySecret = async (credId: string) => {
    const secret = revealed[credId];
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      show("Copied · clears in 30s");
    } catch { show("Copy failed"); }
  };

  const archiveFlag = async (flagId: string) => {
    try {
      await api(`/api/flags/${flagId}/archive`, { method: "POST" });
      show("Archived · deletes in 90 days");
      load();
    } catch (e) { show((e as Error).message); }
  };

  const addFlag = async () => {
    if (!flag.body.trim() || !flag.levelId) { show("Level and body needed"); return; }
    try {
      await api("/api/flags", { method: "POST", body: JSON.stringify({
        clientId: file.id, levelId: flag.levelId, body: flag.body, personId: flag.personId || null
      }) });
      show("Flag added");
      setFlagOn(false); setFlag(f => ({ ...f, body: "", personId: "" }));
      load();
    } catch (e) { show((e as Error).message); }
  };

  const addPerson = async () => {
    if (!person.name.trim()) { show("Name the person"); return; }
    try {
      await api(`/api/clients/${file.id}/people`, { method: "POST", body: JSON.stringify(person) });
      show("Person added");
      setPersonOn(false);
      setPerson({ name: "", title: "", department: "", email: "", phone: "", pinned: false, primary: false });
      load();
    } catch (e) { show((e as Error).message); }
  };

  const addAddr = async () => {
    if (!addr.label.trim()) { show("Label the address"); return; }
    try {
      await api(`/api/clients/${file.id}/addresses`, { method: "POST", body: JSON.stringify(addr) });
      show("Address added");
      setAddrOn(false);
      load();
    } catch (e) { show((e as Error).message); }
  };

  const addVault = async () => {
    if (!vault.title.trim() || !vault.secret) { show("Title and secret needed"); return; }
    try {
      await api(`/api/clients/${file.id}/vault`, { method: "POST", body: JSON.stringify(vault) });
      show("Vault entry saved · list stays masked");
      setVaultOn(false);
      setVault(v => ({ ...v, title: "", username: "", secret: "", url: "", note: "" }));
      load();
    } catch (e) { show((e as Error).message); }
  };

  const addNote = async () => {
    if (!noteDraft.trim()) { show("Write a note"); return; }
    try {
      await api(`/api/clients/${file.id}/notes`, { method: "POST", body: JSON.stringify({ body: noteDraft }) });
      show("Note saved");
      setNoteDraft("");
      load();
    } catch (e) { show((e as Error).message); }
  };

  const upload = async (list: FileList | null) => {
    const f = list?.[0];
    if (!f) return;
    const data = new FormData();
    data.append("file", f);
    try {
      await api(`/api/clients/${file.id}/files`, { method: "POST", body: data });
      show("Uploaded · photos compress");
      load();
    } catch (e) { show((e as Error).message); }
  };

  return (
    <section>
      <div className="file">
        <div className="identity">
          <div className="mark">{initials(file.name)}</div>
          <div style={{ flex: 1 }}>
            <h1>{file.name}</h1>
            <div className="meta">
              <span className={"chip" + (file.status === "Active" ? " on" : "")}>{file.status}</span>
              {file.industry && <span className="chip">{file.industry}</span>}
              {file.county && <span className="chip">{file.county} County</span>}
              {call && <span className="chip">{call}</span>}
              {email && <span className="chip">{email}</span>}
              {contract && <span className="chip">Contract {monthYear(contract)}</span>}
            </div>
            <div className="flags">
              {file.flags.map(f => (
                <div className={"flag " + chipColor(f.color, f.level)} key={f.id}>
                  <b>{f.level || "Flag"} · {f.on}</b>
                  {f.body}
                  <div className="muted" style={{ marginTop: 6 }}>{chiWhen(f.createdAt)}{f.createdBy ? " · " + f.createdBy : ""}</div>
                  <button className="btn s" style={{ marginTop: 6 }} onClick={() => archiveFlag(f.id)}>Archive</button>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button className="btn" onClick={() => setFlagOn(v => !v)}>+ Flag</button>
            <Link className="btn" to={`/clients/${file.id}/print`}>Print sheet</Link>
          </div>
        </div>
        <p className="muted" style={{ margin: "-8px 0 12px" }}>
          {file.updatedAt ? `Updated ${chiWhen(file.updatedAt)} · America/Chicago` : "Client file"}
        </p>

        {flagOn && (
          <div className="card mod" style={{ marginBottom: 14 }}>
            <div className="mod-h"><h2>New flag</h2></div>
            <div className="tools">
              <select className="sel" value={flag.levelId} onChange={e => setFlag({ ...flag, levelId: e.target.value })}>
                {(lookups?.flagLevels || []).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <select className="sel" value={flag.personId} onChange={e => setFlag({ ...flag, personId: e.target.value })}>
                <option value="">On · Account</option>
                {file.people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <textarea className="compose" placeholder="What the shop needs to see before they walk in" value={flag.body} onChange={e => setFlag({ ...flag, body: e.target.value })} />
            <button className="btn p" style={{ marginTop: 10 }} onClick={addFlag}>Save flag</button>
          </div>
        )}

        <div className="actions">
          <BizAct kind="Call" label={call} href={telHref(call)} />
          <BizAct kind="Email" label={email} href={email ? "mailto:" + email : undefined} />
          <BizAct kind="Map" label={map ? mapLabel : undefined} href={map} />
          <BizAct kind="Website" label={website ? host(website) : undefined} href={website} />
        </div>

        <div className="file-top">
          <div>
            <div className="card mod" style={{ marginBottom: 14 }}>
              <div className="mod-h"><h2>People</h2><button className="btn s" onClick={() => setPersonOn(v => !v)}>Add</button></div>
              {personOn && (
                <div className="form-grid" style={{ marginBottom: 12 }}>
                  <input className="sel" placeholder="Name" value={person.name} onChange={e => setPerson({ ...person, name: e.target.value })} />
                  <input className="sel" placeholder="Title" value={person.title} onChange={e => setPerson({ ...person, title: e.target.value })} />
                  <input className="sel" placeholder="Department" value={person.department} onChange={e => setPerson({ ...person, department: e.target.value })} />
                  <input className="sel" placeholder="Email" value={person.email} onChange={e => setPerson({ ...person, email: e.target.value })} />
                  <input className="sel" placeholder="Phone" value={person.phone} onChange={e => setPerson({ ...person, phone: e.target.value })} />
                  <label className="muted"><input type="checkbox" checked={person.primary} onChange={e => setPerson({ ...person, primary: e.target.checked })} /> Primary</label>
                  <label className="muted"><input type="checkbox" checked={person.pinned} onChange={e => setPerson({ ...person, pinned: e.target.checked })} /> Pinned</label>
                  <button className="btn p" onClick={addPerson}>Save person</button>
                </div>
              )}
              {pinned.length > 0 && (
                <div className="dept"><div className="dept-h">Pinned</div>
                  {pinned.map(p => <PersonRow key={"pin-" + p.id} p={p} care={careOn.has(p.name)} />)}
                </div>
              )}
              {depts.map(d => (
                <div className="dept" key={d}>
                  <div className="dept-h">{d}</div>
                  {file.people.filter(p => (p.department || "People") === d).map(p => (
                    <PersonRow key={p.id} p={p} care={careOn.has(p.name)} />
                  ))}
                </div>
              ))}
              {file.people.length === 0 && <p className="muted">No people on this file yet.</p>}
            </div>
            <div className="card mod">
              <div className="mod-h"><h2>Addresses</h2><button className="btn s" onClick={() => setAddrOn(v => !v)}>Add</button></div>
              {addrOn && (
                <div className="form-grid" style={{ marginBottom: 12 }}>
                  <input className="sel" placeholder="Label (Studio)" value={addr.label} onChange={e => setAddr({ ...addr, label: e.target.value })} />
                  <input className="sel" placeholder="Line 1" value={addr.line1} onChange={e => setAddr({ ...addr, line1: e.target.value })} />
                  <input className="sel" placeholder="City" value={addr.city} onChange={e => setAddr({ ...addr, city: e.target.value })} />
                  <input className="sel" placeholder="State" value={addr.state} onChange={e => setAddr({ ...addr, state: e.target.value })} />
                  <input className="sel" placeholder="ZIP" value={addr.zip} onChange={e => setAddr({ ...addr, zip: e.target.value })} />
                  <input className="sel" placeholder="County" value={addr.county} onChange={e => setAddr({ ...addr, county: e.target.value })} />
                  <input className="sel" placeholder="Hours / note" value={addr.hours} onChange={e => setAddr({ ...addr, hours: e.target.value })} />
                  <input className="sel" placeholder="Phone" value={addr.phone} onChange={e => setAddr({ ...addr, phone: e.target.value })} />
                  <label className="muted"><input type="checkbox" checked={addr.isPrimary} onChange={e => setAddr({ ...addr, isPrimary: e.target.checked })} /> Primary</label>
                  <button className="btn p" onClick={addAddr}>Save address</button>
                </div>
              )}
              {file.addresses.map(a => (
                <div className="loc" key={a.id}>
                  <div>
                    <strong>{a.label}</strong>
                    <div className="muted">
                      {[a.line1, a.city, a.state, a.zip].filter(Boolean).join(", ")}
                      <br />
                      {[a.county && `${a.county} County`, a.isPrimary ? "Primary" : "", a.phone, a.hours].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <a className="pin" title="Open in Google Maps" target="_blank" rel="noopener" href={a.maps}>
                    <PinIcon />
                  </a>
                </div>
              ))}
              {file.addresses.length === 0 && <p className="muted">No addresses yet.</p>}
            </div>
          </div>
          <div className="card mod">
            <div className="mod-h"><h2>Services</h2></div>
            <p className="muted" style={{ marginBottom: 8 }}>What they pay BIS for.</p>
            {file.services.map(s => (
              <div className="row" key={s.id}>
                <div><strong>{s.name || "Service"}</strong>{s.note && <div className="muted">{s.note}</div>}</div>
                <span className={"chip" + (s.on ? " on" : "")}>{s.on ? "On" : "Off"}</span>
              </div>
            ))}
            {file.services.length === 0 && <p className="muted">No services on file.</p>}
            <div className="mod-h" style={{ marginTop: 18 }}><h2>Links</h2></div>
            {file.links.map(l => (
              <a className="biglink" key={l.id} href={l.url} target="_blank" rel="noopener">{l.label}<small>{host(l.url)}</small></a>
            ))}
            {file.links.length === 0 && website && (
              <a className="biglink" href={website} target="_blank" rel="noopener">Website<small>{host(website)}</small></a>
            )}
            <div className="mod-h" style={{ marginTop: 18 }}><h2>Vendors</h2></div>
            {file.vendors.map(v => (
              <div className="row" key={v.id}><div><strong>{v.kind}</strong><div className="muted">{v.name}{v.phone ? " · " + v.phone : ""}</div></div></div>
            ))}
            {file.vendors.length === 0 && <p className="muted">No vendors listed.</p>}
          </div>
        </div>

        <div className="modules">
          <div className="card mod">
            <div className="mod-h"><h2>Vault</h2><button className="btn s" onClick={() => setVaultOn(v => !v)}>Add</button></div>
            {vaultOn && (
              <div className="form-grid" style={{ marginBottom: 12 }}>
                <select className="sel" value={vault.department} onChange={e => setVault({ ...vault, department: e.target.value })}>
                  {(lookups?.departments || [{ id: "it", name: "IT" }, { id: "d", name: "Digital" }]).map(d => <option key={d.id}>{d.name}</option>)}
                </select>
                <input className="sel" placeholder="Title" value={vault.title} onChange={e => setVault({ ...vault, title: e.target.value })} />
                <input className="sel" placeholder="Username" value={vault.username} onChange={e => setVault({ ...vault, username: e.target.value })} />
                <input className="sel" type="password" placeholder="Secret" value={vault.secret} onChange={e => setVault({ ...vault, secret: e.target.value })} />
                <input className="sel" placeholder="URL" value={vault.url} onChange={e => setVault({ ...vault, url: e.target.value })} />
                <button className="btn p" onClick={addVault}>Save · stays masked</button>
              </div>
            )}
            {vaultDepts.map(d => (
              <div className="dept" key={d}>
                <div className="dept-h">{d}</div>
                {file.vault.filter(v => (v.department || "Vault") === d).map(v => {
                  const open = revealed[v.id];
                  return (
                    <div className="secret" key={v.id}>
                      <div>
                        <strong>{v.title}</strong>
                        <div className={"muted mono" + (open ? " revealed" : "")}>{[v.username, open || v.secret || "••••••••"].filter(Boolean).join(" · ")}</div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {open && <button className="btn s" onClick={() => copySecret(v.id)}>Copy</button>}
                        <button className="btn s" onClick={() => open ? setRevealed(s => { const n = { ...s }; delete n[v.id]; return n; }) : reveal(v.id)}>
                          {open ? "Hide" : "Reveal"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            {file.vault.length === 0 && <p className="muted">No vault entries. Reveal stays masked until you ask.</p>}
          </div>
          <div className="card mod">
            <div className="mod-h">
              <h2>Files</h2>
              <label className="btn s" style={{ display: "inline-grid", placeItems: "center" }}>
                Upload
                <input type="file" hidden onChange={e => { upload(e.target.files); e.target.value = ""; }} />
              </label>
            </div>
            <p className="muted" style={{ margin: "0 0 6px" }}>Photos compress automatically. Documents stay as uploaded.</p>
            <ul className="files">
              {file.files.map(f => (
                <li key={f.id}>
                  <button className="btn s" style={{ border: 0, background: "transparent", padding: 0, fontWeight: 600, color: "var(--accent)" }} onClick={() => openAuthedFile(f.id, show)}>{f.name}</button>
                  <span className="muted">{fileKind(f.mime, f.kind)} · {bytes(f.bytes)}</span>
                </li>
              ))}
              {file.files.length === 0 && <li className="muted">No files yet.</li>}
            </ul>
          </div>
          <div className="card mod span2">
            <div className="mod-h"><h2>Notes</h2></div>
            {file.notes.map(n => (
              <div className="row" key={n.id}>
                <p className="note">{mention(n.body)}<span className="muted"> · {n.author || "Shop"} · {chiWhen(n.createdAt)}</span></p>
              </div>
            ))}
            <textarea className="compose" placeholder="Standing context. @Name creates a mention." value={noteDraft} onChange={e => setNoteDraft(e.target.value)} />
            <button className="btn s" style={{ marginTop: 8 }} onClick={addNote}>Add note</button>
          </div>
        </div>
      </div>
      <div className="stick">
        {call ? <a href={telHref(call)}>Call</a> : <span>Call</span>}
        {email ? <a href={"mailto:" + email}>Email</a> : <span>Email</span>}
        {map ? <a href={map} target="_blank" rel="noopener">Map</a> : <span>Map</span>}
        {website ? <a href={website} target="_blank" rel="noopener">Web</a> : <span>Web</span>}
      </div>
    </section>
  );
}

export function PrintSheet() {
  const { id } = useParams();
  const [file, setFile] = useState<ClientFileData | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!id) return;
    api<ClientFileData>(`/api/clients/${id}/print`).then(setFile).catch(e => setErr((e as Error).message));
  }, [id]);
  if (err) return <p className="err">{err}</p>;
  if (!file) return <p>Loading print sheet…</p>;
  return (
    <section>
      <div className="h print-hide">
        <div>
          <h1>Print sheet</h1>
          <p>Contacts, addresses, services, links. No passwords. No vault.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="btn" to={`/clients/${file.id}`}>Back to file</Link>
          <button className="btn p" onClick={() => window.print()}>Print</button>
        </div>
      </div>
      <div className="card print-sheet">
        <p className="muted">BIS Consultants · Admin · not for posting</p>
        <h1 style={{ margin: "6px 0 4px" }}>{file.name}</h1>
        <p className="muted">{file.print?.notice || "Printed from Admin · no logins included"}</p>
        <h2>People</h2>
        {file.people.map(p => (
          <p key={p.id}>{[p.name, p.title, p.email, p.phone].filter(Boolean).join(" · ")}</p>
        ))}
        <h2>Addresses</h2>
        {file.addresses.map(a => (
          <p key={a.id}>{[a.label, [a.line1, a.city, a.state, a.zip].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}</p>
        ))}
        <h2>Services</h2>
        {file.services.filter(s => s.on).map(s => (
          <p key={s.id}>{[s.name, s.note, "on"].filter(Boolean).join(" · ")}</p>
        ))}
        <h2>Links</h2>
        {file.links.map(l => <p key={l.id}>{l.label} · {host(l.url)}</p>)}
        <h2>Vendors</h2>
        {file.vendors.map(v => <p key={v.id}>{[v.kind, v.name, v.phone].filter(Boolean).join(" · ")}</p>)}
        {file.flags.length > 0 && (
          <>
            <h2>Operational notes</h2>
            {file.flags.map(f => <p key={f.id}>{f.body}</p>)}
          </>
        )}
        <p className="muted" style={{ marginTop: 22 }}>Care flags and vault passwords are omitted from this sheet.</p>
      </div>
    </section>
  );
}

function BizAct({ kind, label, href }: { kind: string; label?: string; href?: string }) {
  if (!href || !label) {
    return <span className="act off">{kind}<span>Not on file</span></span>;
  }
  const external = href.startsWith("http");
  return <a className="act" href={href} target={external ? "_blank" : undefined} rel={external ? "noopener" : undefined}>{kind}<span>{label}</span></a>;
}

function PersonRow({ p, care }: { p: ClientFileData["people"][number]; care: boolean }) {
  return (
    <div className="row contact">
      <div className="who">
        <div className="av" style={{ background: p.avatarColor || "#1c332c" }}>{p.initials || initials(p.name)}</div>
        <div>
          <strong>{p.name}</strong>
          {p.primary && <span className="chip on">Primary</span>}
          {p.pinned && !p.primary && <span className="chip on">Pinned</span>}
          {care && <span className="pflag">Care</span>}
          {p.title && <div className="muted">{p.title}</div>}
          <div>
            {p.email && <a href={"mailto:" + p.email}>{p.email}</a>}
            {p.email && p.phone ? " · " : ""}
            {p.phone && <a href={telHref(p.phone)}>{p.phone}</a>}
          </div>
        </div>
      </div>
    </div>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </svg>
  );
}

function unique(xs: string[]) {
  return [...new Set(xs)];
}
