import { useEffect, useRef, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { api, login, logout, me, refresh, setToken, token, type User } from "./api";
import { Home } from "./screens/HomeBoard";
import { ClientFile, Clients, PrintSheet } from "./screens/Clients";
import { Flags } from "./screens/Flags";

const IDLE_MS = 15 * 60 * 1000;
type ToastFn = (m: string) => void;

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const show = (m: string) => { setToast(m); window.setTimeout(() => setToast(null), 2200); };

  useEffect(() => {
    document.title = "Admin — BIS Consultants";
    if (!token()) { setReady(true); return; }
    me().then(setUser).catch(() => setToken(null)).finally(() => setReady(true));
  }, []);

  useEffect(() => {
    document.body.setAttribute("data-role", user?.role || "");
    document.getElementById("root")?.classList.toggle("app-shell", !!user);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let last = Date.now();
    const bump = () => { last = Date.now(); };
    ["mousemove", "keydown", "click", "touchstart"].forEach(e => window.addEventListener(e, bump, { passive: true }));
    const idle = window.setInterval(async () => {
      if (Date.now() - last >= IDLE_MS) {
        await logout().catch(() => {});
        setToken(null); setUser(null); show("Signed out · idle 15 minutes");
        window.location.href = "/login";
      }
    }, 5000);
    const slide = window.setInterval(() => { refresh().then(r => setToken(r.token)).catch(() => {}); }, 8 * 60 * 1000);
    return () => {
      window.clearInterval(idle); window.clearInterval(slide);
      ["mousemove", "keydown", "click", "touchstart"].forEach(e => window.removeEventListener(e, bump));
    };
  }, [user]);

  if (!ready) return <div className="content">Loading Admin…</div>;
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login onIn={u => { setUser(u); }} toast={show} />} />
        <Route path="/*" element={user ? <Shell user={user} setUser={setUser} toast={show} /> : <Navigate to="/login" replace />} />
      </Routes>
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

function Login({ onIn, toast }: { onIn: (u: User) => void; toast: ToastFn }) {
  const nav = useNavigate();
  const [email, setEmail] = useState("brandon@bisconsultants.example");
  const [password, setPassword] = useState("Admin!2026");
  const [err, setErr] = useState("");
  return (
    <div className="login-screen">
      <form className="login-box" onSubmit={async e => {
        e.preventDefault();
        try {
          const r = await login(email, password);
          setToken(r.token);
          onIn(r.user);
          toast("Signed in");
          nav("/");
        } catch (ex) { setErr((ex as Error).message); }
      }}>
        <h1>Admin</h1>
        <p>BIS Consultants · staff sign in</p>
        <label>Email</label>
        <input value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" />
        <label>Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
        <button className="btn p" style={{ width: "100%", marginTop: 16 }} type="submit">Sign in</button>
        {err && <p className="err">{err}</p>}
        <p className="muted" style={{ marginTop: 10 }}>brandon@… signs in as Admin. maya@… as Staff. Seed password: Admin!2026</p>
      </form>
    </div>
  );
}

function Shell({ user, setUser, toast }: { user: User; setUser: (u: User | null) => void; toast: ToastFn }) {
  const loc = useLocation();
  const nav = useNavigate();
  const [navOpen, setNavOpen] = useState(false);
  const [whereOn, setWhereOn] = useState(false);
  const [presence, setPresence] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const clocked = !!user.openPunch;
  const place = user.openPunch?.workplace;

  useEffect(() => { api<any[]>("/api/presence").then(setPresence).catch(() => {}); }, [user.openPunch]);
  useEffect(() => { document.body.classList.toggle("nav-open", navOpen); }, [navOpen]);

  const clock = async (workplace?: string) => {
    setWhereOn(false);
    if (clocked) {
      await api("/api/time/clock", { method: "POST", body: JSON.stringify({ dir: "out", workplace: place }) });
      toast("Clocked out");
    } else {
      let destination: string | undefined;
      if (workplace === "road") destination = prompt("Heading where?", "Murray Media") || undefined;
      if (workplace === "road" && !destination) return;
      await api("/api/time/clock", { method: "POST", body: JSON.stringify({ dir: "in", workplace, destination }) });
      toast("Clocked in · " + (workplace || "office") + (destination ? " · " + destination : ""));
    }
    setUser(await me());
  };

  const signOut = async () => {
    await logout().catch(() => {});
    setToken(null); setUser(null); toast("Signed out · clocked out"); nav("/login");
  };

  const go = (path: string) => { setNavOpen(false); nav(path); };
  const admin = user.role === "admin";
  const active = (p: string) => loc.pathname === p || loc.pathname.startsWith(p + "/");

  return (
    <>
      <aside className="sidebar">
        <div className="brand">Admin<small>BIS Consultants</small></div>
        <div className="nav-label">Workspace</div>
        <NavBtn on={() => go("/")} active={loc.pathname === "/"} label="Home" />
        <NavBtn on={() => go("/clients")} active={active("/clients")} label="Clients" />
        <NavBtn on={() => go("/flags")} active={active("/flags")} label="Flags" />
        <NavBtn on={() => go("/team")} active={active("/team")} label="Team" />
        <NavBtn on={() => go("/time")} active={active("/time")} label="Time" />
        <NavBtn on={() => go("/post-it")} active={active("/post-it")} label="#Post It" />
        <NavBtn on={() => go("/kudos")} active={active("/kudos")} label="Kudos" />
        <NavBtn on={() => go("/mentions")} active={active("/mentions")} label="@Mentions" />
        <div className="nav-label">Company</div>
        {admin && <NavBtn on={() => go("/audit")} active={active("/audit")} label="Audit" />}
        {admin && <NavBtn on={() => go("/reports")} active={active("/reports")} label="Reports" />}
        {admin && <NavBtn on={() => go("/admin")} active={active("/admin")} label="Admin" />}
        <NavBtn on={() => go("/settings")} active={active("/settings")} label="Settings" />
        <div className="nav-label">Open</div>
        <button className="nav-btn" onClick={() => go("/clients/66666666-6666-6666-6666-666666666601")}>Murray Media</button>
        <div className="nav-label">Signed in</div>
        <div className="presence">
          {presence.map(p => (
            <div className="pres" key={p.id}>
              <span className={p.presence?.status !== "out" ? "doton" : "dotoff"} />
              {p.name.split(" ")[0]} · {p.presence?.label || "Out"}{p.presence?.destination ? " · " + p.presence.destination : ""}
            </div>
          ))}
        </div>
        <div className="foot" onClick={signOut}>Sign out<span>{admin ? "Admin" : "Staff"} · Sign out also clocks out</span></div>
      </aside>
      <div className="main">
        <div className="top">
          <button className="menu" aria-label="Open menu" onClick={() => setNavOpen(v => !v)}>☰</button>
          <input className="search" placeholder="Search clients, people, addresses" value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") nav("/clients?q=" + encodeURIComponent(q)); }} />
          <div className="who-chip">
            <button className="photo-btn" onClick={() => nav("/me")} title="My profile" aria-label="My profile"><div className="me">{user.initials}</div></button>
            <button onClick={() => nav("/me")} style={{ border: 0, background: "transparent", textAlign: "left", padding: 0 }}>
              <div className="who-meta">{user.name}</div>
            </button>
            <button className="btn p" onClick={() => clocked ? clock() : setWhereOn(v => !v)}>{clocked ? "Clock out" : "Clock in"}</button>
            {clocked && <button className="btn s" onClick={() => setWhereOn(v => !v)}>{place || "Place"}</button>}
            <div className={"where-pop" + (whereOn ? " on" : "")}>
              <button onClick={() => clock("office")}>Office</button>
              <button onClick={() => clock("road")}>Road</button>
              <button onClick={() => clock("home")}>Home</button>
            </div>
          </div>
        </div>
        <div className="scrim" onClick={() => setNavOpen(false)} />
        <div className="content">
          {!clocked && loc.pathname !== "/login" && (
            <div className="nudge"><div>You’re signed in and not punched. Clock in so the shop knows where you are.</div>
              <button className="btn p" onClick={() => setWhereOn(true)}>Clock in</button></div>
          )}
          <Routes>
            <Route path="/" element={<Home user={user} toast={toast} />} />
            <Route path="/clients" element={<Clients toast={toast} admin={admin} />} />
            <Route path="/clients/:id" element={<ClientFile toast={toast} />} />
            <Route path="/clients/:id/print" element={<PrintSheet />} />
            <Route path="/flags" element={<Flags toast={toast} admin={admin} />} />
            <Route path="/team" element={<Team toast={toast} admin={admin} />} />
            <Route path="/team/:id" element={<Member toast={toast} />} />
            <Route path="/me" element={<Me user={user} setUser={setUser} toast={toast} />} />
            <Route path="/time" element={<Time user={user} setUser={setUser} toast={toast} />} />
            <Route path="/reports" element={admin ? <Reports toast={toast} /> : <Navigate to="/" />} />
            <Route path="/audit" element={admin ? <Audit toast={toast} /> : <Navigate to="/" />} />
            <Route path="/post-it" element={<PostIt user={user} toast={toast} />} />
            <Route path="/kudos" element={<KudosPage toast={toast} />} />
            <Route path="/mentions" element={<Mentions />} />
            <Route path="/admin" element={admin ? <AdminPage toast={toast} /> : <Navigate to="/" />} />
            <Route path="/settings" element={<Settings admin={admin} />} />
          </Routes>
        </div>
      </div>
    </>
  );
}

function NavBtn({ on, active, label }: { on: () => void; active: boolean; label: string }) {
  return <button className={"nav-btn" + (active ? " active" : "")} onClick={on}>{label}</button>;
}

function Team({ toast, admin }: { toast: ToastFn; admin: boolean }) {
  const [rows, setRows] = useState<any[]>([]);
  const nav = useNavigate();
  useEffect(() => { api<any[]>("/api/team").then(setRows); }, []);
  return (
    <section>
      <div className="h"><div><h1>Team</h1><p>BIS people · tap to call · clock in so the shop knows where you are</p></div>
        {admin && <button className="btn" onClick={() => exportCsv("/api/admin/export/people", toast)}>Export</button>}
      </div>
      <div className="card team-table"><div className="table-wrap"><table>
        <thead><tr><th></th><th>Name</th><th>Title</th><th>Dept</th><th>Mobile</th><th>Work</th><th>Ext</th><th>Where</th></tr></thead>
        <tbody>
          {rows.map(u => (
            <tr key={u.id}>
              <td><span className={u.where?.status !== "out" ? "doton" : "dotoff"} /></td>
              <td><div className="who"><div className="av" style={{ background: u.avatarColor, width: 40, height: 40 }}>{u.initials}</div>
                <div><strong className="go" onClick={() => nav("/team/" + u.id)}>{u.name}</strong><div className="muted">{u.email}</div></div></div></td>
              <td>{u.title}</td><td>{u.department}</td>
              <td><a href={"tel:" + u.phoneMobile}>{u.phoneMobile}</a></td>
              <td><a href={"tel:" + u.phoneWork}>{u.phoneWork}</a></td>
              <td>{u.ext}</td>
              <td><span className={"chip status-" + (u.where?.status || "out")}>{u.where?.label}{u.where?.destination ? " · " + u.where.destination : ""}</span></td>
            </tr>
          ))}
        </tbody>
      </table></div></div>
    </section>
  );
}

function Member({ toast }: { toast: ToastFn }) {
  const { id } = useParams();
  const [u, setU] = useState<any>(null);
  useEffect(() => { api("/api/team/" + id).then(setU); }, [id]);
  if (!u) return <p>Loading…</p>;
  return (
    <section>
      <div className="h"><div><h1>{u.name}</h1><p>{u.title} · {u.department}</p></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a className="btn p" href={"tel:" + u.phoneMobile}>Call mobile</a>
          <a className="btn" href={"mailto:" + u.email}>Email</a>
          <button className="btn" onClick={async () => {
            const body = prompt("One thing " + u.name.split(" ")[0] + " did"); if (!body) return;
            await api("/api/kudos", { method: "POST", body: JSON.stringify({ toUserId: u.id, body }) });
            toast("Star to " + u.name + " · " + body); setU(await api("/api/team/" + id));
          }}>Give a star</button>
          {u.birthdayInWindow && <button className="btn p" onClick={() => { confetti(); toast("Happy birthday, " + u.name.split(" ")[0]); }}>Shout happy birthday</button>}
        </div>
      </div>
      <div className="modules">
        <div className="card mod">
          <div className="who" style={{ marginBottom: 12 }}><div className="av" style={{ background: u.avatarColor, width: 56, height: 56, fontSize: 16 }}>{u.initials}</div>
            <div><strong>{u.name}</strong><div className="muted">{u.role === "admin" ? "Admin" : "Staff"}</div></div></div>
          <div className="row"><span className="muted">Mobile</span><a href={"tel:" + u.phoneMobile}>{u.phoneMobile}</a></div>
          <div className="row"><span className="muted">Work</span><a href={"tel:" + u.phoneWork}>{u.phoneWork}</a></div>
          <div className="row"><span className="muted">Ext</span><strong>{u.ext}</strong></div>
          <div className="row"><span className="muted">Email</span><a href={"mailto:" + u.email}>{u.email}</a></div>
        </div>
        <div className="card mod">
          <div className="mod-h"><h2>Work</h2></div>
          <div className="row"><span className="muted">Department</span><strong>{u.department}</strong></div>
          <div className="row"><span className="muted">Manager</span><strong>{u.manager || "—"}</strong></div>
          <div className="row"><span className="muted">Where</span><span className={"chip status-" + (u.where?.status || "out")}>{u.where?.label}</span></div>
          {u.coveringFor && <div className="row"><span className="muted">Covering</span><strong>{u.coveringFor}</strong></div>}
        </div>
        <div className="card mod">
          <div className="mod-h"><h2>This week</h2></div>
          <div className="row"><span className="muted">Kudos</span><strong>{u.kudosWeek} ★ week · {u.kudosMonth} ★ month</strong></div>
          <div className="row"><span className="muted">Mentions</span><strong>{u.mentionsWeek}</strong></div>
        </div>
        <div className="card mod"><div className="mod-h"><h2>Notes</h2></div><p className="note">{u.notes}</p></div>
      </div>
    </section>
  );
}

function Me({ user, setUser, toast }: { user: User; setUser: (u: User) => void; toast: ToastFn }) {
  const [name, setName] = useState(user.name);
  const [mobile, setMobile] = useState(user.phoneMobile || "");
  const [work, setWork] = useState(user.phoneWork || "");
  const [ext, setExt] = useState(user.ext || "");
  return (
    <section>
      <div className="h"><div><h1>My profile</h1><p>Your Admin user · not a client contact</p></div>
        <button className="btn p" onClick={async () => {
          const u = await api<User>("/api/me", { method: "PUT", body: JSON.stringify({ name, phoneMobile: mobile, phoneWork: work, ext }) });
          setUser(u); toast("Saved");
        }}>Save</button>
      </div>
      <div className="modules">
        <div className="card mod"><div className="me" style={{ width: 72, height: 72, fontSize: 22, borderRadius: "50%", background: "#1c332c", color: "#d5eee4", display: "grid", placeItems: "center" }}>{user.initials}</div><p className="muted" style={{ marginTop: 12 }}>Initials until you upload</p></div>
        <div className="card mod">
          <div className="mod-h"><h2>You</h2></div>
          <label className="muted">Name</label><input className="sel" style={{ width: "100%", margin: "6px 0 12px" }} value={name} onChange={e => setName(e.target.value)} />
          <label className="muted">Email</label><input className="sel" style={{ width: "100%", margin: "6px 0 12px" }} value={user.email} readOnly />
          <label className="muted">Mobile</label><input className="sel" style={{ width: "100%", margin: "6px 0 12px" }} value={mobile} onChange={e => setMobile(e.target.value)} />
          <label className="muted">Work phone</label><input className="sel" style={{ width: "100%", margin: "6px 0 12px" }} value={work} onChange={e => setWork(e.target.value)} />
          <label className="muted">Extension</label><input className="sel" style={{ width: "100%", margin: "6px 0 12px" }} value={ext} onChange={e => setExt(e.target.value)} />
        </div>
        <div className="card mod span2">
          <div className="mod-h"><h2>Work</h2></div>
          <div className="row"><span className="muted">Department</span><strong>{user.department}</strong></div>
          <div className="row"><span className="muted">Role</span><strong>{user.role === "admin" ? "Admin" : "Staff"}</strong></div>
          <div className="row"><span className="muted">Manager</span><strong>{user.manager || "—"}</strong></div>
          <p className="muted" style={{ marginTop: 8 }}>Department, role, and manager are set on the Users list.</p>
        </div>
      </div>
    </section>
  );
}

function Time({ user, setUser, toast }: { user: User; setUser: (u: User) => void; toast: ToastFn }) {
  const [data, setData] = useState<any>(null);
  const load = () => api("/api/time").then(setData);
  useEffect(() => { load(); }, []);
  if (!data) return <p>Loading punches…</p>;
  return (
    <section>
      <div className="h"><div><h1>Time</h1><p>Your punches. Clock in from the header — it lands here.</p></div></div>
      <div className="stats">
        <div className="stat"><span>Today</span><b>{data.todayHours}h</b></div>
        <div className="stat"><span>This week</span><b>{data.weekHours}h</b></div>
        <div className="stat"><span>Status</span><b style={{ fontSize: 18 }}>{data.open ? "In" : "Out"}</b></div>
        <div className="stat"><span>Workplace</span><b style={{ fontSize: 18 }}>{data.open?.workplace || "—"}</b></div>
      </div>
      <div className="card"><div className="table-wrap"><table>
        <thead><tr><th>When</th><th>In / Out</th><th>Where</th><th>Note</th><th></th></tr></thead>
        <tbody>
          {data.punches.map((p: any) => (
            <tr key={p.id}>
              <td>{new Date(p.at).toLocaleString()}</td><td>{p.dir === "in" ? "In" : "Out"}</td>
              <td>{p.workplace}{p.destination ? " · " + p.destination : ""}</td>
              <td className="muted">{p.note || "—"}</td>
              <td><button className="btn s" onClick={async () => {
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

function Reports({ toast }: { toast: ToastFn }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { api("/api/reports").then(setData); }, []);
  if (!data) return <p>Loading reports…</p>;
  return (
    <section>
      <div className="h"><div><h1>Reports</h1><p>Admin · time for the whole shop</p></div>
        <button className="btn p" onClick={() => exportCsv("/api/admin/export/clients", toast)}>Export</button></div>
      <div className="stats">
        <div className="stat"><span>Hours this week</span><b>{Math.round(data.totals.hours)}</b></div>
        <div className="stat"><span>Office</span><b>{Math.round(data.totals.office)}</b></div>
        <div className="stat"><span>Road</span><b>{Math.round(data.totals.road)}</b></div>
        <div className="stat"><span>Home</span><b>{Math.round(data.totals.home)}</b></div>
      </div>
      <div className="card" style={{ marginBottom: 14 }}><div className="table-wrap"><table>
        <thead><tr><th>Name</th><th>Dept</th><th>Office</th><th>Road</th><th>Home</th><th>Total</th></tr></thead>
        <tbody>{data.byPerson.map((r: any) => <tr key={r.userId}><td><strong>{r.name}</strong></td><td>{r.dept}</td><td>{fmtH(r.office)}</td><td>{fmtH(r.road)}</td><td>{fmtH(r.home)}</td><td>{fmtH(r.total)}</td></tr>)}</tbody>
      </table></div></div>
      <div className="card"><div className="mod-h" style={{ padding: "12px 12px 0" }}><h2>Punches · this week</h2></div>
        <div className="table-wrap"><table>
          <thead><tr><th>Who</th><th>When</th><th>In / Out</th><th>Where</th><th>Note</th></tr></thead>
          <tbody>{data.punches.map((p: any, i: number) => <tr key={i}><td>{p.who}</td><td>{new Date(p.at).toLocaleString()}</td><td>{p.dir}</td><td>{p.workplace}</td><td className="muted">{p.destination || "—"}</td></tr>)}</tbody>
        </table></div>
      </div>
    </section>
  );
}

function Audit({ toast }: { toast: ToastFn }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { api<any[]>("/api/audit").then(setRows); }, []);
  return (
    <section>
      <div className="h"><div><h1>Audit</h1><p>Every change. Revert writes a new line — the log itself cannot be edited.</p></div>
        <button className="btn p" onClick={() => exportCsv("/api/admin/export/audit", toast)}>Export log</button></div>
      <div className="card"><div className="table-wrap"><table>
        <thead><tr><th>When</th><th>Who</th><th>Did</th><th>On</th><th></th></tr></thead>
        <tbody>{rows.map(a => (
          <tr key={a.id}>
            <td className="muted">{new Date(a.createdAt).toLocaleString()}</td>
            <td>{a.actor}</td><td>{a.action} · {a.objectType}</td><td>{a.clientId || a.objectType}</td>
            <td>{a.canRevert ? <button className="btn s" onClick={async () => {
              const reason = prompt("Reason for revert") || "revert";
              await api(`/api/audit/${a.id}/revert`, { method: "POST", body: JSON.stringify({ reason }) });
              toast("Reverted · new audit line written"); setRows(await api("/api/audit"));
            }}>Revert</button> : <span className="muted">—</span>}</td>
          </tr>
        ))}</tbody>
      </table></div></div>
      <p className="muted" style={{ marginTop: 10 }}>Vault passwords and API token values are never stored in this log.</p>
    </section>
  );
}

function PostIt({ user, toast }: { user: User; toast: ToastFn }) {
  const [notes, setNotes] = useState<any[]>([]);
  const board = useRef<HTMLDivElement>(null);
  const load = () => api<any[]>("/api/stickies").then(setNotes);
  useEffect(() => { load(); }, []);
  const add = async (color: string) => {
    const text = prompt("What’s the note?"); if (!text) return;
    await api("/api/stickies", { method: "POST", body: JSON.stringify({ x: 50 + Math.random() * 260, y: 40 + Math.random() * 160, color, text }) });
    toast("Note added"); load();
  };
  return (
    <section>
      <div className="h"><div><h1>#Post It</h1><p>One board. Drag a note. Pin it to someone. Black pen · no games.</p></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn p" onClick={() => add("s-y")}>+ Yellow</button>
          <button className="btn" onClick={() => add("s-p")}>Pink</button>
          <button className="btn" onClick={() => add("s-b")}>Blue</button>
          <button className="btn" onClick={() => add("s-g")}>Green</button>
          <button className="btn p" onClick={async () => {
            const created = await api<{ id: string }>("/api/stickies", { method: "POST", body: JSON.stringify({ x: 80, y: 80, color: "s-y", text: "" }) });
            toast("Black pen · signed " + user.initials); load();
            return created;
          }}>Draw</button>
        </div>
      </div>
      <div className="board" ref={board}>
        {notes.map(n => (
          <div key={n.id} className={"sticky " + n.color} style={{ left: n.x, top: n.y }}
            onPointerDown={e => {
              const el = e.currentTarget;
              const br = board.current!.getBoundingClientRect();
              const ox = e.clientX - el.getBoundingClientRect().left;
              const oy = e.clientY - el.getBoundingClientRect().top;
              const move = (ev: PointerEvent) => {
                el.style.left = Math.max(8, ev.clientX - br.left - ox) + "px";
                el.style.top = Math.max(8, ev.clientY - br.top - oy) + "px";
              };
              const up = async (ev: PointerEvent) => {
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", up);
                await api("/api/stickies/" + n.id, { method: "PUT", body: JSON.stringify({ x: parseFloat(el.style.left), y: parseFloat(el.style.top) }) });
              };
              window.addEventListener("pointermove", move);
              window.addEventListener("pointerup", up);
            }}>
            {n.text}{rich("")}
            {n.drawBlob && <img alt="" src={"data:image/png;base64," + n.drawBlob} style={{ width: "100%" }} />}
            <button className="x" onClick={async ev => { ev.stopPropagation(); await api("/api/stickies/" + n.id, { method: "DELETE" }); load(); }}>×</button>
            <span className="who">{n.pinned || "Shop"}</span>
          </div>
        ))}
      </div>
      <DrawPad onSave={async data => {
        const created = await api<{ id: string }>("/api/stickies", { method: "POST", body: JSON.stringify({ x: 90, y: 90, color: "s-y", text: user.initials }) });
        await fetch("/api/stickies/" + created.id + "/draw", { method: "POST", headers: { Authorization: "Bearer " + token() }, body: data });
        toast("Black pen · signed " + user.initials); load();
      }} />
      <div className="here"><span className="muted">On #Post It</span><span className="chip on">{user.name.split(" ")[0]}</span></div>
    </section>
  );
}

function DrawPad({ onSave }: { onSave: (b: Blob) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.strokeStyle = "#1a1a1a"; ctx.lineWidth = 2.2; ctx.lineCap = "round";
    let on = false;
    const pt = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height] as const;
    };
    c.onpointerdown = e => { on = true; const [x, y] = pt(e); ctx.beginPath(); ctx.moveTo(x, y); };
    c.onpointermove = e => { if (!on) return; const [x, y] = pt(e); ctx.lineTo(x, y); ctx.stroke(); };
    c.onpointerup = () => { on = false; };
  }, []);
  return (
    <div style={{ marginTop: 12 }}>
      <p className="muted">Black pen</p>
      <canvas className="draw-canvas" ref={ref} width={146} height={78} />
      <button className="btn s" style={{ marginLeft: 8 }} onClick={() => ref.current?.toBlob(b => b && onSave(b), "image/png")}>Pin drawing</button>
    </div>
  );
}

function KudosPage({ toast }: { toast: ToastFn }) {
  const [data, setData] = useState<any>(null);
  const [team, setTeam] = useState<any[]>([]);
  const [to, setTo] = useState("");
  const [why, setWhy] = useState("");
  useEffect(() => { api("/api/kudos").then(setData); api<any[]>("/api/team").then(t => { setTeam(t); setTo(t[0]?.id); }); }, []);
  if (!data) return <p>Loading kudos…</p>;
  return (
    <section>
      <div className="h"><div><h1>Kudos</h1><p>One person. One thing they did. Counted by week, summed by month.</p></div></div>
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
          toast("Star given"); setWhy(""); setData(await api("/api/kudos"));
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
          {data.latest.map((k: any) => <div className="row" key={k.id}><div><strong>{k.from} → {k.to}</strong><div className="muted">{k.body}</div></div><span>★</span></div>)}
        </div>
      </div>
      <p className="muted" style={{ marginTop: 10 }}>One star per note. Name the person, name the thing.</p>
    </section>
  );
}

function Mentions() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { api<any[]>("/api/mentions").then(setRows); }, []);
  return (
    <section>
      <div className="h"><div><h1>@Mentions</h1><p>Everywhere someone tagged you — notes, #Post It, kudos, flags, the board.</p></div></div>
      <div className="card"><div className="table-wrap"><table>
        <thead><tr><th>When</th><th>Where</th><th>Said</th></tr></thead>
        <tbody>{rows.map(m => <tr key={m.id}><td className="muted">{new Date(m.createdAt).toLocaleString()}</td><td>{m.sourceType}</td><td>{rich(m.snippet)}</td></tr>)}</tbody>
      </table></div></div>
    </section>
  );
}

function AdminPage({ toast }: { toast: ToastFn }) {
  const [users, setUsers] = useState<any[]>([]);
  const [deps, setDeps] = useState<any[]>([]);
  const [svcs, setSvcs] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [tokens, setTokens] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  useEffect(() => {
    api<any[]>("/api/admin/users").then(setUsers);
    api<any[]>("/api/admin/departments").then(setDeps);
    api<any[]>("/api/admin/services").then(setSvcs);
    api<any[]>("/api/admin/flag-levels").then(setLevels);
    api<any[]>("/api/admin/tokens").then(setTokens);
    api("/api/admin/settings").then(setSettings);
  }, []);
  return (
    <section>
      <div className="h"><div><h1>Admin</h1><p>BIS users, departments, and exports. Admin only.</p></div></div>
      <div className="card mod" style={{ marginBottom: 14 }}>
        <div className="mod-h"><h2>Who can do what</h2></div>
        <p className="muted">Staff: client file, vault reveal, flags, team, own time, #Post It, kudos, mentions, print (no secrets). Admin: reports, audit, users, catalog, tokens, export.</p>
      </div>
      <div className="modules">
        <div className="card mod span2">
          <div className="mod-h"><h2>Users</h2></div>
          <div className="table-wrap"><table>
            <thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Manager</th><th>Role</th></tr></thead>
            <tbody>{users.map(u => <tr key={u.id}><td><strong>{u.name}</strong></td><td>{u.email}</td><td>{u.department}</td><td>{u.manager || "—"}</td><td><span className="role">{u.role}</span></td></tr>)}</tbody>
          </table></div>
        </div>
        <div className="card mod"><div className="mod-h"><h2>Departments</h2></div>{deps.map(d => <div className="row" key={d.id}><strong>{d.name}</strong></div>)}</div>
        <div className="card mod span2"><div className="mod-h"><h2>Service catalog</h2></div>{svcs.map(s => <div className="row" key={s.id}><div><strong>{s.name}</strong><div className="muted">{s.description}</div></div></div>)}</div>
        <div className="card mod span2"><div className="mod-h"><h2>Flag levels</h2></div>{levels.map(l => <div className="row" key={l.id}><div><strong>{l.name}</strong><div className="muted">{l.description}</div></div><span className={"chip " + l.color}>{l.name}</span></div>)}</div>
        <div className="card mod span2">
          <div className="mod-h"><h2>Single sign-on</h2><span className="chip">{settings?.ssoEnabled ? "On" : "Off"}</span></div>
          <p className="muted">Built, but disabled. Staff keep email + password until an admin turns this on via SSO_ENABLED.</p>
          <div className="set-row"><div><strong>Enable SSO</strong><div className="muted">Off on purpose for first launch</div></div><div className={"toggle" + (settings?.ssoEnabled ? " on" : "")}><i /></div></div>
        </div>
        <div className="card mod span2">
          <div className="mod-h"><h2>Access tokens</h2><button className="btn s" onClick={async () => {
            const name = prompt("Token name"); if (!name) return;
            const r = await api<{ token: string }>("/api/admin/tokens", { method: "POST", body: JSON.stringify({ name, internal: false }) });
            toast("Copy once: " + r.token);
            setTokens(await api("/api/admin/tokens"));
          }}>Add token</button></div>
          <p className="muted">Header: Authorization: Bearer adm_ext_… · read-only · no vault · no admin routes</p>
          <div className="table-wrap"><table>
            <thead><tr><th>Name</th><th>For</th><th>Token</th><th></th></tr></thead>
            <tbody>{tokens.map(t => <tr key={t.id}><td><strong>{t.name}</strong></td><td className="muted">{t.internal ? "Internal" : t.contact}</td><td className="mono">{t.token}</td>
              <td><button className="btn s" onClick={async () => { const r = await api<{ token: string }>(`/api/admin/tokens/${t.id}/regenerate`, { method: "POST" }); toast("Copy once: " + r.token); }}>Regenerate</button></td></tr>)}</tbody>
          </table></div>
        </div>
        <div className="card mod span2">
          <div className="mod-h"><h2>Export</h2><span className="chip on">Admin only</span></div>
          <p className="muted">Login titles and usernames only — never passwords.</p>
          <div className="tools">
            <button className="btn p" onClick={() => exportCsv("/api/admin/export/clients", toast)}>Export clients + addresses</button>
            <button className="btn" onClick={() => exportCsv("/api/admin/export/people", toast)}>Export people</button>
            <button className="btn" onClick={() => exportCsv("/api/admin/export/flags", toast)}>Export flags</button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Settings({ admin }: { admin: boolean }) {
  return (
    <section>
      <div className="h"><div><h1>Settings</h1><p>Workspace options for Admin at BIS Consultants.</p></div></div>
      <div className="modules">
        {admin && <div className="card mod"><div className="mod-h"><h2>Workspace</h2></div>
          <div className="set-row"><div><strong>Company name</strong><div className="muted">BIS Consultants</div></div></div>
          <div className="set-row"><div><strong>Idle after</strong><div className="muted">15 minutes with no mouse or key → log out</div></div></div>
        </div>}
        <div className="card mod"><div className="mod-h"><h2>Files</h2></div>
          <div className="set-row"><div><strong>Compress photos</strong><div className="muted">JPEG, longest edge 1600px · ~72</div></div><div className="toggle on"><i /></div></div>
        </div>
        <div className="card mod"><div className="mod-h"><h2>Vault</h2></div>
          <div className="set-row"><div><strong>Clear copied password</strong><div className="muted">30 seconds</div></div></div>
        </div>
        {admin && <div className="card mod"><div className="mod-h"><h2>Geofence</h2></div>
          <div className="set-row"><div><strong>Never auto Home</strong><div className="muted">Home is a tap, not a fence.</div></div><div className="toggle on"><i /></div></div>
        </div>}
      </div>
    </section>
  );
}

function rich(text: string) {
  const parts = text.split(/(@[A-Za-z][A-Za-z0-9._-]*)/g);
  return parts.map((p, i) => p.startsWith("@") ? <Link className="mention" key={i} to="/mentions">{p}</Link> : <span key={i}>{p}</span>);
}
function fmtH(n: number) { return n ? `${Math.round(n)}h` : "—"; }
async function exportCsv(path: string, toast: ToastFn) {
  try {
    const t = token();
    const res = await fetch(path, { headers: { Authorization: "Bearer " + t } });
    if (res.status === 403) { toast("Admin only · export blocked"); return; }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "admin-export.csv";
    a.click();
    toast("Export started · admin");
  } catch { toast("Export failed"); }
}
function confetti() {
  const colors = ["#1c7a5c", "#e7b549", "#d36b6b", "#2b5f8a", "#fff"];
  for (let i = 0; i < 60; i++) {
    const p = document.createElement("i");
    p.className = "confetti";
    p.style.left = Math.random() * 100 + "vw";
    p.style.background = colors[i % colors.length];
    document.body.appendChild(p);
    const x = (Math.random() - 0.5) * 120;
    p.animate([{ transform: "translate(0,0)", opacity: 1 }, { transform: `translate(${x}px,110vh)`, opacity: 0 }], { duration: 900 + Math.random() * 800 });
    setTimeout(() => p.remove(), 1800);
  }
}
