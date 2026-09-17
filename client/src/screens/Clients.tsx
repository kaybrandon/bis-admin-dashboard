import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { copyVaultPassword } from "../clipboardVault";
import type { ClientFile as ClientFileData, ClientListRow, Lookups } from "../contracts";
import { bytes, chipColor, exportCsv, fileKind, host, initials, mention, monthYear, openAuthedFile, telHref, chiWhen } from "../screenUtil";
import { workspace } from "../workspace";

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
  const [sort, setSort] = useState<keyof ClientListRow | null>(null);
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
    if (!sort) return rows;
    return [...rows].sort((a, b) => {
      const av = String(a[sort] ?? "").toLowerCase();
      const bv = String(b[sort] ?? "").toLowerCase();
      return av < bv ? -dir : av > bv ? dir : 0;
    });
  }, [rows, sort, dir]);

  const th = (key: keyof ClientListRow, label: string) => (
    <th className="th-sort" onClick={() => { if (sort === key) setDir(d => d === 1 ? -1 : 1); else { setSort(key); setDir(1); } }}>{label}{sort === key ? (dir === 1 ? " ↑" : " ↓") : ""}</th>
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
  const [flagsOpen, setFlagsOpen] = useState(true);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    addresses: true, services: true, links: true, vendors: true
  });
  const [openDepts, setOpenDepts] = useState<Record<string, boolean>>({});
  const [flagOn, setFlagOn] = useState(false);
  const [coreOn, setCoreOn] = useState(false);
  const [personOn, setPersonOn] = useState(false);
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [addrOn, setAddrOn] = useState(false);
  const [editingAddrId, setEditingAddrId] = useState<string | null>(null);
  const [svcOn, setSvcOn] = useState(false);
  const [editingSvcId, setEditingSvcId] = useState<string | null>(null);
  const [linkOn, setLinkOn] = useState(false);
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [vendorOn, setVendorOn] = useState(false);
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);
  const [vaultOn, setVaultOn] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [flag, setFlag] = useState({ levelId: "", body: "", personId: "" });
  const [core, setCore] = useState({ name: "", industry: "", status: "Active", county: "", businessPhone: "", businessEmail: "", website: "" });
  const [person, setPerson] = useState({ name: "", title: "", department: "", email: "", phone: "", pinned: false, primary: false });
  const [addr, setAddr] = useState({ label: "", line1: "", city: "", state: "TX", zip: "", county: "", hours: "", isPrimary: false, phone: "" });
  const [svc, setSvc] = useState({ serviceTypeId: "", on: true, note: "" });
  const [link, setLink] = useState({ label: "", url: "" });
  const [vendor, setVendor] = useState({ kind: "", name: "", phone: "" });
  const [vault, setVault] = useState({ department: "IT", title: "", username: "", secret: "", url: "", note: "" });

  const load = () => {
    if (!id) return;
    api<ClientFileData>("/api/clients/" + id)
      .then(setFile)
      .catch(e => setErr((e as Error).message));
  };

  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    if (!id) return;
    setFlagsOpen(readFlagsOpen(id));
    setOpenSections({
      addresses: readSectionOpen(id, "addresses", true),
      services: readSectionOpen(id, "services", true),
      links: readSectionOpen(id, "links", true),
      vendors: readSectionOpen(id, "vendors", true)
    });
    setOpenDepts({});
  }, [id]);
  useEffect(() => { api<Lookups>("/api/lookups").then(l => {
    setLookups(l);
    if (l.flagLevels[0]) setFlag(f => ({ ...f, levelId: f.levelId || l.flagLevels[0].id }));
    if (l.departments[0]) setVault(v => ({ ...v, department: v.department || l.departments[0].name }));
    if (l.services[0]) setSvc(s => ({ ...s, serviceTypeId: s.serviceTypeId || l.services[0].id }));
  }).catch(() => {}); }, []);

  if (err) return <p className="err">{err}</p>;
  if (!file) return <p>Loading client file…</p>;

  const biz = file.business || {};
  const primaryPerson = file.people.find(p => p.primary) || file.people[0];
  const call = biz.call || file.businessPhone;
  const email = biz.email || file.businessEmail || primaryPerson?.email;
  const website = biz.website || file.website;
  const map = biz.map;
  const careOn = new Set(file.flags.filter(f => (f.color || f.level || "").toLowerCase().includes("care")).map(f => f.on));
  const pinned = file.people.filter(p => p.pinned).sort((a, b) => (a.primary === b.primary ? 0 : a.primary ? -1 : 1));
  const unpinned = file.people.filter(p => !p.pinned);
  const depts = sortDepts(unique(unpinned.map(p => p.department || "People")));
  const flagLevels = unique(file.flags.map(f => f.level).filter(Boolean) as string[]);
  const flagSummary = file.flags.length === 0
    ? ""
    : `${file.flags.length} flag${file.flags.length === 1 ? "" : "s"} · ${flagLevels.join(", ")}.`;
  const primaryAddr = file.addresses.find(a => a.isPrimary) || file.addresses[0];
  const place = primaryAddr?.city && primaryAddr?.state
    ? `${primaryAddr.city}, ${primaryAddr.state}`
    : file.county ? `${file.county}, TX` : file.county;
  const persistFlagsOpen = (open: boolean) => {
    setFlagsOpen(open);
    if (id) writeFlagsOpen(id, open);
  };
  const persistSection = (name: string, open: boolean) => {
    setOpenSections(s => ({ ...s, [name]: open }));
    if (id) writeSectionOpen(id, name, open);
  };
  const isDeptOpen = (name: string) => {
    if (Object.prototype.hasOwnProperty.call(openDepts, name)) return openDepts[name];
    return id ? readDeptOpen(id, name, name === "Pinned") : name === "Pinned";
  };
  const persistDept = (name: string, open: boolean) => {
    setOpenDepts(s => ({ ...s, [name]: open }));
    if (id) writeDeptOpen(id, name, open);
  };
  const titleChoices = personTitleOptions(lookups, person.title);
  const vaultDepts = unique(file.vault.map(v => v.department || "Vault"));

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
      const seconds = workspace().clipboardClearSeconds;
      await copyVaultPassword(secret, seconds);
      show("Copied · clears in " + seconds + "s");
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

  const saveCore = async () => {
    if (!core.name.trim()) { show("Name the client"); return; }
    try {
      await api(`/api/clients/${file.id}`, { method: "PUT", body: JSON.stringify({
        name: core.name, industry: core.industry, status: core.status, county: core.county,
        businessPhone: core.businessPhone, businessEmail: core.businessEmail, website: core.website
      }) });
      show("Client saved");
      setCoreOn(false);
      load();
    } catch (e) { show((e as Error).message); }
  };

  const addPerson = async () => {
    if (!person.name.trim()) { show("Name the person"); return; }
    try {
      const payload = { ...person, pinned: person.pinned || person.primary };
      if (editingPersonId) {
        await api(`/api/clients/${file.id}/people/${editingPersonId}`, { method: "PUT", body: JSON.stringify(payload) });
        show("Person saved");
      } else {
        await api(`/api/clients/${file.id}/people`, { method: "POST", body: JSON.stringify(payload) });
        show("Person added");
      }
      setPersonOn(false);
      setEditingPersonId(null);
      setPerson({ name: "", title: "", department: "", email: "", phone: "", pinned: false, primary: false });
      load();
    } catch (e) { show((e as Error).message); }
  };

  const startEditPerson = (p: ClientFileData["people"][number]) => {
    setPersonOn(false);
    setEditingPersonId(p.id);
    setPerson({
      name: p.name, title: p.title || "", department: p.department || "",
      email: p.email || "", phone: p.phone || "", pinned: p.pinned, primary: p.primary
    });
  };

  const togglePin = async (p: ClientFileData["people"][number]) => {
    const next = !p.pinned;
    setFile(f => f ? { ...f, people: f.people.map(x => x.id === p.id ? { ...x, pinned: next } : x) } : f);
    try {
      await api(`/api/clients/${file.id}/people/${p.id}/pin`, { method: "POST", body: JSON.stringify({ pinned: next }) });
    } catch (e) {
      show((e as Error).message);
      load();
    }
  };

  const addAddr = async () => {
    if (!addr.label.trim()) { show("Label the address"); return; }
    try {
      if (editingAddrId) {
        await api(`/api/clients/${file.id}/addresses/${editingAddrId}`, { method: "PUT", body: JSON.stringify(addr) });
        show("Address saved");
      } else {
        await api(`/api/clients/${file.id}/addresses`, { method: "POST", body: JSON.stringify(addr) });
        show("Address added");
      }
      setAddrOn(false);
      setEditingAddrId(null);
      setAddr({ label: "", line1: "", city: "", state: "TX", zip: "", county: "", hours: "", isPrimary: false, phone: "" });
      load();
    } catch (e) { show((e as Error).message); }
  };

  const startEditAddr = (a: ClientFileData["addresses"][number]) => {
    setAddrOn(false);
    setEditingAddrId(a.id);
    setAddr({
      label: a.label, line1: a.line1 || "", city: a.city || "", state: a.state || "TX",
      zip: a.zip || "", county: a.county || "", hours: a.hours || "", isPrimary: a.isPrimary, phone: a.phone || ""
    });
  };

  const saveSvc = async () => {
    if (!svc.serviceTypeId) { show("Pick a service"); return; }
    try {
      if (editingSvcId) {
        await api(`/api/clients/${file.id}/services/${editingSvcId}`, { method: "PUT", body: JSON.stringify(svc) });
        show("Service saved");
      } else {
        await api(`/api/clients/${file.id}/services`, { method: "POST", body: JSON.stringify(svc) });
        show("Service added");
      }
      setSvcOn(false);
      setEditingSvcId(null);
      setSvc({ serviceTypeId: lookups?.services[0]?.id || "", on: true, note: "" });
      load();
    } catch (e) { show((e as Error).message); }
  };

  const startEditSvc = (s: ClientFileData["services"][number]) => {
    setSvcOn(false);
    setEditingSvcId(s.id);
    setSvc({ serviceTypeId: s.serviceTypeId || lookups?.services.find(x => x.name === s.name)?.id || "", on: s.on, note: s.note || "" });
  };

  const removeSvc = async (id: string) => {
    if (!window.confirm("Remove this service from the file?")) return;
    try {
      await api(`/api/clients/${file.id}/services/${id}`, { method: "DELETE" });
      show("Service removed");
      load();
    } catch (e) { show((e as Error).message); }
  };

  const saveLink = async () => {
    if (!link.label.trim() || !link.url.trim()) { show("Label and URL needed"); return; }
    try {
      if (editingLinkId) {
        await api(`/api/clients/${file.id}/links/${editingLinkId}`, { method: "PUT", body: JSON.stringify(link) });
        show("Link saved");
      } else {
        await api(`/api/clients/${file.id}/links`, { method: "POST", body: JSON.stringify(link) });
        show("Link added");
      }
      setLinkOn(false);
      setEditingLinkId(null);
      setLink({ label: "", url: "" });
      load();
    } catch (e) { show((e as Error).message); }
  };

  const startEditLink = (l: ClientFileData["links"][number]) => {
    setLinkOn(false);
    setEditingLinkId(l.id);
    setLink({ label: l.label, url: l.url });
  };

  const removeLink = async (id: string) => {
    if (!window.confirm("Remove this link?")) return;
    try {
      await api(`/api/clients/${file.id}/links/${id}`, { method: "DELETE" });
      show("Link removed");
      load();
    } catch (e) { show((e as Error).message); }
  };

  const saveVendor = async () => {
    if (!vendor.kind.trim() || !vendor.name.trim()) { show("Kind and name needed"); return; }
    try {
      if (editingVendorId) {
        await api(`/api/clients/${file.id}/vendors/${editingVendorId}`, { method: "PUT", body: JSON.stringify(vendor) });
        show("Vendor saved");
      } else {
        await api(`/api/clients/${file.id}/vendors`, { method: "POST", body: JSON.stringify(vendor) });
        show("Vendor added");
      }
      setVendorOn(false);
      setEditingVendorId(null);
      setVendor({ kind: "", name: "", phone: "" });
      load();
    } catch (e) { show((e as Error).message); }
  };

  const startEditVendor = (v: ClientFileData["vendors"][number]) => {
    setVendorOn(false);
    setEditingVendorId(v.id);
    setVendor({ kind: v.kind, name: v.name, phone: v.phone || "" });
  };

  const removeVendor = async (id: string) => {
    if (!window.confirm("Remove this vendor?")) return;
    try {
      await api(`/api/clients/${file.id}/vendors/${id}`, { method: "DELETE" });
      show("Vendor removed");
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
    <section className="client-file">
      <div className="client-file-shell">
        <div className="client-file-head">
          <div className="client-file-id">
            <div className="mark">{initials(file.name)}</div>
            <div className="client-file-id-body">
              <div className="client-file-title">
                <h1>{file.name}</h1>
                <button type="button" className="btn s" onClick={() => {
                  const next = !coreOn;
                  setCoreOn(next);
                  if (next) setCore({
                    name: file.name, industry: file.industry || "", status: file.status || "Active",
                    county: file.county || "", businessPhone: file.businessPhone || "",
                    businessEmail: file.businessEmail || "", website: file.website || ""
                  });
                }}>{coreOn ? "Cancel" : "Edit"}</button>
              </div>
              <div className="meta">
                <span className={"chip" + (file.status === "Active" ? " on" : "")}>{file.status}</span>
                {file.industry && <span className="chip">{file.industry}</span>}
                {place && <span className="chip">{place}</span>}
                {call && <span className="chip">{call}</span>}
                {email && <span className="chip">{email}</span>}
              </div>
              <nav className="client-file-biz" aria-label="Business">
                {call && <a href={telHref(call)}>Call</a>}
                {email && <a href={"mailto:" + email}>Email</a>}
                {map && <a href={map} target="_blank" rel="noopener">Map</a>}
                {website && <a href={website} target="_blank" rel="noopener">Website</a>}
              </nav>
              <p className="client-file-updated muted">
                {file.updatedAt ? `Updated ${chiAgo(file.updatedAt)}` : "Client file"}
              </p>
            </div>
          </div>
        </div>
        <div className="client-file-actions">
          <button className="btn" onClick={() => setFlagOn(v => !v)}>+ Flag</button>
          <Link className="btn" to={`/clients/${file.id}/print`}>Print sheet</Link>
        </div>
        {file.flags.length > 0 && (
          <div className="client-file-flag-block">
            <div className="client-file-flag-bar">
              <button type="button" className="client-file-flag-summary" onClick={() => persistFlagsOpen(!flagsOpen)} aria-expanded={flagsOpen}>
                {flagSummary}
              </button>
              {flagsOpen && (
                <button type="button" className="client-file-flag-collapse" onClick={() => persistFlagsOpen(false)}>
                  Collapse all
                </button>
              )}
            </div>
            {flagsOpen && (
              <div className="client-file-flags">
                {file.flags.map(f => (
                  <div className={"flag " + chipColor(f.color, f.level)} key={f.id}>
                    <b>{f.level || "Flag"} · {f.on}</b>
                    <p className="flag-body">{f.body}</p>
                    <div className="muted" style={{ marginTop: 6 }}>{chiWhen(f.createdAt)}{f.createdBy ? " · " + f.createdBy : ""}</div>
                    <button className="btn s" style={{ marginTop: 6 }} onClick={() => archiveFlag(f.id)}>Archive</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {coreOn && (
          <div className="card mod" style={{ marginBottom: 14 }}>
            <div className="mod-h"><h2>Edit client</h2></div>
            <div className="form-grid">
              <input className="sel" placeholder="Name" value={core.name} onChange={e => setCore({ ...core, name: e.target.value })} />
              <input className="sel" placeholder="Industry" value={core.industry} onChange={e => setCore({ ...core, industry: e.target.value })} />
              <select className="sel" value={core.status} onChange={e => setCore({ ...core, status: e.target.value })}>
                <option>Active</option><option>Prospect</option>
              </select>
              <select className="sel" value={core.county} onChange={e => setCore({ ...core, county: e.target.value })}>
                <option value="">County</option>
                {(lookups?.counties || []).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input className="sel" placeholder="Business phone" value={core.businessPhone} onChange={e => setCore({ ...core, businessPhone: e.target.value })} />
              <input className="sel" placeholder="Business email" value={core.businessEmail} onChange={e => setCore({ ...core, businessEmail: e.target.value })} />
              <input className="sel" placeholder="Website" value={core.website} onChange={e => setCore({ ...core, website: e.target.value })} />
            </div>
            <button className="btn p" style={{ marginTop: 10 }} onClick={saveCore}>Save client</button>
          </div>
        )}

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

        <div className="client-file-grid">
          <div className="client-file-main">
            <div className="card mod" style={{ marginBottom: 14 }}>
              <div className="mod-h"><h2>People</h2><button className="btn s" onClick={() => {
                setEditingPersonId(null);
                setPerson({ name: "", title: "", department: "", email: "", phone: "", pinned: false, primary: false });
                setPersonOn(v => !v);
              }}>+ Add</button></div>
              {(personOn || editingPersonId) && (
                <div className="form-grid" style={{ marginBottom: 12 }}>
                  <input className="sel" placeholder="Name" value={person.name} onChange={e => setPerson({ ...person, name: e.target.value })} />
                  <select className="sel" value={person.title} onChange={e => setPerson({ ...person, title: e.target.value })} aria-label="Title">
                    <option value="">Title</option>
                    {titleChoices.map(t => (
                      <option key={t.id} value={t.name}>{t.name}{t.retired ? " (retired)" : ""}</option>
                    ))}
                  </select>
                  <input className="sel" placeholder="Department" value={person.department} onChange={e => setPerson({ ...person, department: e.target.value })} />
                  <input className="sel" placeholder="Email" value={person.email} onChange={e => setPerson({ ...person, email: e.target.value })} />
                  <input className="sel" placeholder="Phone" value={person.phone} onChange={e => setPerson({ ...person, phone: e.target.value })} />
                  <label className="muted"><input type="checkbox" checked={person.primary} onChange={e => setPerson({ ...person, primary: e.target.checked, pinned: e.target.checked ? true : person.pinned })} /> Primary</label>
                  <label className="muted"><input type="checkbox" checked={person.pinned || person.primary} onChange={e => setPerson({ ...person, pinned: e.target.checked })} /> Pinned</label>
                  <button className="btn p" onClick={addPerson}>Save person</button>
                  {editingPersonId && <button className="btn s" onClick={() => { setEditingPersonId(null); setPerson({ name: "", title: "", department: "", email: "", phone: "", pinned: false, primary: false }); }}>Cancel</button>}
                </div>
              )}
              {pinned.length > 0 && (
                <div className="dept">
                  <FoldHead label="Pinned" open={isDeptOpen("Pinned")} onToggle={() => persistDept("Pinned", !isDeptOpen("Pinned"))} />
                  {isDeptOpen("Pinned") && pinned.map(p => <PersonRow key={"pin-" + p.id} p={p} care={careOn.has(p.name)} onPin={togglePin} onEdit={startEditPerson} />)}
                </div>
              )}
              {depts.map(d => (
                <div className="dept" key={d}>
                  <FoldHead label={d} open={isDeptOpen(d)} onToggle={() => persistDept(d, !isDeptOpen(d))} />
                  {isDeptOpen(d) && unpinned.filter(p => (p.department || "People") === d).map(p => (
                    <PersonRow key={p.id} p={p} care={careOn.has(p.name)} onPin={togglePin} onEdit={startEditPerson} />
                  ))}
                </div>
              ))}
              {file.people.length === 0 && <p className="muted">No people on this file yet.</p>}
            </div>
            <FileSection title="Addresses" open={openSections.addresses !== false} onToggle={() => persistSection("addresses", openSections.addresses === false)} onAdd={() => {
              setEditingAddrId(null);
              setAddr({ label: "", line1: "", city: "", state: "TX", zip: "", county: "", hours: "", isPrimary: false, phone: "" });
              setAddrOn(v => !v);
            }}>
              {(addrOn || editingAddrId) && (
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
                  {editingAddrId && <button className="btn s" onClick={() => { setEditingAddrId(null); setAddr({ label: "", line1: "", city: "", state: "TX", zip: "", county: "", hours: "", isPrimary: false, phone: "" }); }}>Cancel</button>}
                </div>
              )}
              {[...file.addresses].sort((a, b) => (a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1)).map(a => (
                <div className="loc" key={a.id}>
                  <div>
                    <strong>{a.label}</strong>
                    <div className="muted">
                      {[a.line1, a.city, a.state, a.zip].filter(Boolean).join(", ")}
                      <br />
                      {[a.county && `${a.county} County`, a.isPrimary ? "Primary" : "", a.phone, a.hours].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div className="row-actions">
                    <button type="button" className="client-file-pin" onClick={() => startEditAddr(a)}>Edit</button>
                    <a className="pin" title="Open in Google Maps" target="_blank" rel="noopener" href={a.maps}>
                      <PinIcon />
                    </a>
                  </div>
                </div>
              ))}
              {file.addresses.length === 0 && <p className="muted">No addresses yet.</p>}
            </FileSection>
          </div>
          <div className="client-file-side">
            <FileSection title="Services" open={openSections.services !== false} onToggle={() => persistSection("services", openSections.services === false)} onAdd={() => {
              setEditingSvcId(null);
              setSvc({ serviceTypeId: lookups?.services[0]?.id || "", on: true, note: "" });
              setSvcOn(v => !v);
            }}>
              <p className="muted" style={{ marginBottom: 8 }}>What they pay BIS for.</p>
              {(svcOn || editingSvcId) && (
                <div className="form-grid" style={{ marginBottom: 12 }}>
                  <select className="sel" value={svc.serviceTypeId} onChange={e => setSvc({ ...svc, serviceTypeId: e.target.value })}>
                    {(lookups?.services || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <input className="sel" placeholder="Note" value={svc.note} onChange={e => setSvc({ ...svc, note: e.target.value })} />
                  <label className="muted"><input type="checkbox" checked={svc.on} onChange={e => setSvc({ ...svc, on: e.target.checked })} /> On</label>
                  <button className="btn p" onClick={saveSvc}>{editingSvcId ? "Save service" : "Add service"}</button>
                  {editingSvcId && <button className="btn s" onClick={() => { setEditingSvcId(null); setSvcOn(false); }}>Cancel</button>}
                </div>
              )}
              {[...file.services].sort((a, b) => (a.on === b.on ? (a.name || "").localeCompare(b.name || "") : a.on ? -1 : 1)).map(s => (
                <div className="row" key={s.id}>
                  <div><strong>{s.name || "Service"}</strong>{s.note && <div className="muted">{s.note}</div>}</div>
                  <div className="row-actions">
                    <span className={"chip" + (s.on ? " on" : "")}>{s.on ? "On" : "Off"}</span>
                    <button type="button" className="client-file-pin" onClick={() => startEditSvc(s)}>Edit</button>
                    <button type="button" className="client-file-pin" onClick={() => removeSvc(s.id)}>Remove</button>
                  </div>
                </div>
              ))}
              {file.services.length === 0 && <p className="muted">No services on file.</p>}
            </FileSection>
            <FileSection title="Links" open={openSections.links !== false} onToggle={() => persistSection("links", openSections.links === false)} onAdd={() => {
              setEditingLinkId(null);
              setLink({ label: "", url: "" });
              setLinkOn(v => !v);
            }}>
              {(linkOn || editingLinkId) && (
                <div className="form-grid" style={{ marginBottom: 12 }}>
                  <input className="sel" placeholder="Label" value={link.label} onChange={e => setLink({ ...link, label: e.target.value })} />
                  <input className="sel" placeholder="URL" value={link.url} onChange={e => setLink({ ...link, url: e.target.value })} />
                  <button className="btn p" onClick={saveLink}>{editingLinkId ? "Save link" : "Add link"}</button>
                  {editingLinkId && <button className="btn s" onClick={() => { setEditingLinkId(null); setLinkOn(false); setLink({ label: "", url: "" }); }}>Cancel</button>}
                </div>
              )}
              {file.links.map(l => (
                <div className="row" key={l.id}>
                  <a className="biglink" href={l.url} target="_blank" rel="noopener">{l.label}<small>{host(l.url)}</small></a>
                  <div className="row-actions">
                    <button type="button" className="client-file-pin" onClick={() => startEditLink(l)}>Edit</button>
                    <button type="button" className="client-file-pin" onClick={() => removeLink(l.id)}>Remove</button>
                  </div>
                </div>
              ))}
              {file.links.length === 0 && website && (
                <a className="biglink" href={website} target="_blank" rel="noopener">Website<small>{host(website)}</small></a>
              )}
              {file.links.length === 0 && !website && <p className="muted">No links yet.</p>}
            </FileSection>
            <FileSection title="Vendors" open={openSections.vendors !== false} onToggle={() => persistSection("vendors", openSections.vendors === false)} onAdd={() => {
              setEditingVendorId(null);
              setVendor({ kind: "", name: "", phone: "" });
              setVendorOn(v => !v);
            }}>
              {(vendorOn || editingVendorId) && (
                <div className="form-grid" style={{ marginBottom: 12 }}>
                  <input className="sel" placeholder="Kind (Internet)" value={vendor.kind} onChange={e => setVendor({ ...vendor, kind: e.target.value })} />
                  <input className="sel" placeholder="Name" value={vendor.name} onChange={e => setVendor({ ...vendor, name: e.target.value })} />
                  <input className="sel" placeholder="Phone" value={vendor.phone} onChange={e => setVendor({ ...vendor, phone: e.target.value })} />
                  <button className="btn p" onClick={saveVendor}>{editingVendorId ? "Save vendor" : "Add vendor"}</button>
                  {editingVendorId && <button className="btn s" onClick={() => { setEditingVendorId(null); setVendorOn(false); setVendor({ kind: "", name: "", phone: "" }); }}>Cancel</button>}
                </div>
              )}
              {file.vendors.map(v => (
                <div className="row" key={v.id}>
                  <div><strong>{v.kind}</strong><div className="muted">{v.name}{v.phone ? " · " + v.phone : ""}</div></div>
                  <div className="row-actions">
                    <button type="button" className="client-file-pin" onClick={() => startEditVendor(v)}>Edit</button>
                    <button type="button" className="client-file-pin" onClick={() => removeVendor(v.id)}>Remove</button>
                  </div>
                </div>
              ))}
              {file.vendors.length === 0 && <p className="muted">No vendors listed.</p>}
            </FileSection>
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
      <nav className="client-file-stick" aria-label="Business">
        {call ? <a href={telHref(call)}>Call</a> : <span>Call</span>}
        {email ? <a href={"mailto:" + email}>Email</a> : <span>Email</span>}
        {map ? <a href={map} target="_blank" rel="noopener">Map</a> : <span>Map</span>}
        {website ? <a href={website} target="_blank" rel="noopener">Website</a> : <span>Website</span>}
      </nav>
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

function PersonRow({ p, care, onPin, onEdit }: { p: ClientFileData["people"][number]; care: boolean; onPin: (p: ClientFileData["people"][number]) => void; onEdit: (p: ClientFileData["people"][number]) => void }) {
  return (
    <div className="row contact">
      <div className="who">
        <div className="av" style={{ background: p.avatarColor || "#1c332c" }}>{p.initials || initials(p.name)}</div>
        <div>
          <div className="person-line">
            <strong>{p.name}</strong>
            {p.title && <span className="muted person-title">{p.title}</span>}
            {p.primary && <span className="chip on">Primary</span>}
            {p.pinned && !p.primary && <span className="chip on">Pinned</span>}
            {care && <span className="pflag">Care</span>}
          </div>
          <div className="person-contact">
            {p.email && <a href={"mailto:" + p.email}>{p.email}</a>}
            {p.email && p.phone ? " · " : ""}
            {p.phone && <a href={telHref(p.phone)}>{p.phone}</a>}
          </div>
        </div>
      </div>
      <div className="row-actions">
        <button type="button" className="client-file-pin" onClick={() => onEdit(p)}>Edit</button>
        <button type="button" className="client-file-pin" onClick={() => onPin(p)} title={p.pinned ? "Unpin" : "Pin"} aria-label={p.pinned ? "Unpin " + p.name : "Pin " + p.name}>
          {p.pinned ? "Unpin" : "Pin"}
        </button>
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

function FileSection({ title, open, onToggle, onAdd, children }: {
  title: string; open: boolean; onToggle: () => void; onAdd: () => void; children: ReactNode;
}) {
  return (
    <div className="card mod">
      <div className="mod-h">
        <FoldHead label={title} open={open} onToggle={onToggle} heading />
        <button className="btn s" onClick={onAdd}>+ Add</button>
      </div>
      {open && children}
    </div>
  );
}

function FoldHead({ label, open, onToggle, heading }: { label: string; open: boolean; onToggle: () => void; heading?: boolean }) {
  return (
    <button type="button" className={"file-fold" + (heading ? " file-fold-h" : "")} onClick={onToggle} aria-expanded={open}>
      <span className="file-fold-caret" aria-hidden>{open ? "▾" : "▸"}</span>
      {heading ? <h2>{label}</h2> : <span className="dept-h">{label}</span>}
    </button>
  );
}

function personTitleOptions(lookups: Lookups | null, current?: string) {
  const titles = lookups?.titles || [];
  const active = titles.filter(t => !t.retired);
  const cur = (current || "").trim();
  if (cur && !active.some(t => t.name === cur)) {
    const retired = titles.find(t => t.retired && t.name === cur);
    return retired ? [...active, retired] : [...active, { id: "current", name: cur, retired: true }];
  }
  return active;
}

function unique(xs: string[]) {
  return [...new Set(xs)];
}

const DEPT_ORDER = ["Operations", "IT", "Digital"];

function sortDepts(xs: string[]) {
  return [...xs].sort((a, b) => {
    const ia = DEPT_ORDER.indexOf(a);
    const ib = DEPT_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

function flagsOpenKey(id: string) {
  return "bis.admin.clientFile.flagsOpen." + id;
}

function readFlagsOpen(id: string) {
  try {
    const v = sessionStorage.getItem(flagsOpenKey(id));
    if (v === "1") return true;
    if (v === "0") return false;
  } catch { /* private mode */ }
  return true;
}

function sectionOpenKey(id: string, section: string) {
  return "bis.admin.clientFile.sectionOpen." + id + "." + section;
}

function readSectionOpen(id: string, section: string, fallback: boolean) {
  try {
    const v = sessionStorage.getItem(sectionOpenKey(id, section));
    if (v === "1") return true;
    if (v === "0") return false;
  } catch { /* private mode */ }
  return fallback;
}

function writeSectionOpen(id: string, section: string, open: boolean) {
  try { sessionStorage.setItem(sectionOpenKey(id, section), open ? "1" : "0"); } catch { /* private mode */ }
}

function deptOpenKey(id: string, dept: string) {
  return "bis.admin.clientFile.deptOpen." + id + "." + dept;
}

function readDeptOpen(id: string, dept: string, fallback: boolean) {
  try {
    const v = sessionStorage.getItem(deptOpenKey(id, dept));
    if (v === "1") return true;
    if (v === "0") return false;
  } catch { /* private mode */ }
  return fallback;
}

function writeDeptOpen(id: string, dept: string, open: boolean) {
  try { sessionStorage.setItem(deptOpenKey(id, dept), open ? "1" : "0"); } catch { /* private mode */ }
}

function writeFlagsOpen(id: string, open: boolean) {
  try { sessionStorage.setItem(flagsOpenKey(id), open ? "1" : "0"); } catch { /* private mode */ }
}

function chiAgo(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
