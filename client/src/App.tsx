import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { login, logout, me, refresh, setToken, token, type User } from "./api";
import { clearCopiedPasswordNow } from "./clipboardVault";
import { ClientFile, Clients } from "./screens/Clients";
import { EmptyPage } from "./screens/EmptyPage";
import { Flags } from "./screens/Flags";
import { Home } from "./screens/HomeBoard";
import { VaultPage } from "./screens/VaultPage";
import { DEFAULT_WORKSPACE, loadWorkspace, resetWorkspace, type WorkspaceSettings } from "./workspace";

type ToastFn = (m: string) => void;

const NAV = [
  { to: "/", label: "Home", end: true },
  { to: "/clients", label: "Clients" },
  { to: "/flags", label: "Flags" },
  { to: "/team", label: "Team" },
  { to: "/time", label: "Time" },
  { to: "/vault", label: "Vault" },
  { to: "/connectors", label: "Connectors" },
  { to: "/accounting", label: "Accounting" },
  { to: "/reports", label: "Reports" },
  { to: "/settings", label: "Settings" },
  { to: "/service-desk", label: "Service desk" },
  { to: "/field", label: "Field" },
  { to: "/security", label: "Security" },
  { to: "/billing", label: "Billing" }
] as const;

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceSettings>(DEFAULT_WORKSPACE);
  const show = (m: string) => { setToast(m); window.setTimeout(() => setToast(null), 2200); };

  useEffect(() => {
    document.title = "Admin · BIS Consultants";
  }, []);

  useEffect(() => {
    if (!token()) { setReady(true); return; }
    me().then(setUser).catch(() => setToken(null)).finally(() => setReady(true));
  }, []);

  useEffect(() => {
    document.body.setAttribute("data-role", user?.role || "");
    document.getElementById("root")?.classList.toggle("app-shell", !!user);
    if (!user) { resetWorkspace(); setWorkspace(DEFAULT_WORKSPACE); return; }
    loadWorkspace().then(setWorkspace).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const idleMs = Math.max(1, workspace.idleMinutes) * 60 * 1000;
    let last = Date.now();
    const bump = () => { last = Date.now(); };
    ["mousemove", "keydown", "click", "touchstart"].forEach(e => window.addEventListener(e, bump, { passive: true }));
    const idle = window.setInterval(async () => {
      if (Date.now() - last >= idleMs) {
        await clearCopiedPasswordNow().catch(() => {});
        await logout().catch(() => {});
        setToken(null); setUser(null); show("Signed out · idle " + workspace.idleMinutes + " minutes");
        window.location.href = "/login";
      }
    }, 5000);
    const slide = window.setInterval(() => { refresh().then(r => setToken(r.token)).catch(() => {}); }, 8 * 60 * 1000);
    return () => {
      window.clearInterval(idle); window.clearInterval(slide);
      ["mousemove", "keydown", "click", "touchstart"].forEach(e => window.removeEventListener(e, bump));
    };
  }, [user, workspace.idleMinutes]);

  if (!ready) return <div className="boot">Loading Admin…</div>;
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login onIn={setUser} toast={show} />} />
        <Route path="/*" element={user ? <Shell user={user} setUser={setUser} toast={show} /> : <Navigate to="/login" replace />} />
      </Routes>
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

function Login({ onIn, toast }: { onIn: (u: User) => void; toast: ToastFn }) {
  const nav = useNavigate();
  const [email, setEmail] = useState("brandon@bisconsultants.example");
  const [password, setPassword] = useState("");
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
        <p className="brand-mark">Admin · BIS Consultants</p>
        <h1>Sign in</h1>
        <label htmlFor="email">Email</label>
        <input id="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" />
        <label htmlFor="password">Password</label>
        <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
        <button className="btn primary" type="submit">Sign in</button>
        {err && <p className="err">{err}</p>}
      </form>
    </div>
  );
}

function Shell({ user, setUser, toast }: {
  user: User; setUser: (u: User | null) => void; toast: ToastFn;
}) {
  const loc = useLocation();
  const nav = useNavigate();
  const [navOpen, setNavOpen] = useState(false);
  const [clockOpen, setClockOpen] = useState(false);
  const [place, setPlace] = useState<"" | "office" | "road">("");

  useEffect(() => { document.body.classList.toggle("nav-open", navOpen); }, [navOpen]);
  useEffect(() => { setNavOpen(false); setClockOpen(false); }, [loc.pathname]);

  const signOut = async () => {
    await clearCopiedPasswordNow().catch(() => {});
    await logout().catch(() => {});
    setToken(null); setUser(null); toast("Signed out"); nav("/login");
  };

  const placeLabel = place === "office" ? "In office" : place === "road" ? "On the road" : "";

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">Admin · BIS Consultants</div>
        <nav className="rail" aria-label="Admin">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={"end" in item ? item.end : false}
              className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
              onClick={() => setNavOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button type="button" className="logout" onClick={signOut}>Log out</button>
      </aside>
      <div className="main">
        <header className="topbar">
          <button type="button" className="menu" aria-label="Open menu" onClick={() => setNavOpen(v => !v)}>Menu</button>
          <div className="top-actions">
            {placeLabel && <span className="place-chip">{placeLabel}</span>}
            <span className="who">{user.name}</span>
            <div className="clock-wrap">
              <button type="button" className="btn primary" onClick={() => setClockOpen(v => !v)}>Clock In</button>
              {clockOpen && (
                <div className="clock-pop">
                  <button type="button" onClick={() => { setPlace("office"); setClockOpen(false); }}>Office</button>
                  <button type="button" onClick={() => { setPlace("road"); setClockOpen(false); }}>Road</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="scrim" onClick={() => setNavOpen(false)} />
        <div className="content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/clients/:id" element={<ClientFile />} />
            <Route path="/flags" element={<Flags />} />
            <Route path="/team" element={<EmptyPage title="Team" />} />
            <Route path="/time" element={<EmptyPage title="Time" />} />
            <Route path="/vault" element={<VaultPage />} />
            <Route path="/connectors" element={<EmptyPage title="Connectors" />} />
            <Route path="/accounting" element={<EmptyPage title="Accounting" />} />
            <Route path="/reports" element={<EmptyPage title="Reports" />} />
            <Route path="/settings" element={<EmptyPage title="Settings" />} />
            <Route path="/service-desk" element={<EmptyPage title="Service desk" message="Connect a PSA in Connectors." />} />
            <Route path="/field" element={<EmptyPage title="Field" />} />
            <Route path="/security" element={<EmptyPage title="Security" />} />
            <Route path="/billing" element={<EmptyPage title="Billing" />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
