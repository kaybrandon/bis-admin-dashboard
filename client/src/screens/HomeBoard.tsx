import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type User } from "../api";
import type { HomeBoard, HomePost } from "../contracts";
import { firstName, hourWord, mention } from "../screenUtil";

type ToastFn = (m: string) => void;
type TeamLite = { id: string; name: string };
type Compose =
  | { type: "win" }
  | { type: "update" }
  | { type: "edit"; post: HomePost }
  | { type: "kudos" }
  | { type: "star" }
  | { type: "mention" };

export function Home({ user, toast }: { user: User; toast: ToastFn }) {
  const [board, setBoard] = useState<HomeBoard | null>(null);
  const [team, setTeam] = useState<TeamLite[]>([]);
  const [err, setErr] = useState("");
  const [postOn, setPostOn] = useState(false);
  const [kind, setKind] = useState("win");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [celebrateOn, setCelebrateOn] = useState(false);
  const [compose, setCompose] = useState<Compose | null>(null);
  const admin = user.role === "admin";

  const load = () =>
    api<HomeBoard>("/api/home")
      .then(setBoard)
      .catch(e => setErr((e as Error).message));

  useEffect(() => {
    load();
    api<TeamLite[]>("/api/team").then(setTeam).catch(() => {});
  }, []);

  const names = useMemo(() => Object.fromEntries(team.map(t => [t.id, t.name])), [team]);
  const celebrations = useMemo(() => {
    if (!board) return [];
    if (board.celebrations?.length) return board.celebrations;
    return [
      ...(board.birthdays ?? []).map(b => ({ ...b, kind: "birthday" as const })),
      ...(board.anniversaries ?? []).map(a => ({ ...a, kind: "anniversary" as const }))
    ];
  }, [board]);

  if (err) return <p className="err">{err}</p>;
  if (!board) return <p>Loading team board…</p>;

  const updates = board.posts.filter(p => p.kind === "update");
  const featuredUpdate = updates[0];
  const openPost = board.posts.find(p => p.id === openId);
  const maxMentions = Math.max(1, ...board.mentions.map(m => m.count));
  const [first, second, third] = board.kudosTop;
  const starTo = board.starOfDay
    ? names[board.starOfDay.to || ""] || board.starOfDay.to || "teammate"
    : "";
  const starFrom = board.starOfDay
    ? names[board.starOfDay.from] || (board.starOfDay.from.length > 20 ? "" : board.starOfDay.from)
    : "";

  const submitPost = async () => {
    if (!title.trim() || !body.trim()) { toast("Title and body needed"); return; }
    try {
      await api("/api/posts", { method: "POST", body: JSON.stringify({ kind, title, body }) });
      toast(kind === "win" ? "Win posted" : "Update posted");
      setTitle(""); setBody(""); setPostOn(false);
      load();
    } catch (e) { toast((e as Error).message); }
  };

  return (
    <section className="home-page">
      <div className="h">
        <div>
          <h1>Good {hourWord()}, {firstName(user.name)}</h1>
          <p>Team board · this week · {weekRange(board.weekStart, board.weekEnd, board.weekLabel)}</p>
        </div>
        {admin && <button className="btn p admin-only" onClick={() => setPostOn(v => !v)}>+ Post</button>}
      </div>

      {postOn && admin && (
        <div className="card mod home-card" style={{ marginBottom: 14 }}>
          <div className="mod-h"><h2>New post</h2><span className="chip">Admin · this week</span></div>
          <div className="tools">
            <select className="sel" value={kind} onChange={e => setKind(e.target.value)}>
              <option value="win">Win</option>
              <option value="update">Update</option>
            </select>
          </div>
          <input className="sel" style={{ width: "100%", margin: "0 0 10px" }} placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
          <textarea className="compose" placeholder="What happened? @Name mentions land in the inbox." value={body} onChange={e => setBody(e.target.value)} />
          <button className="btn p" style={{ marginTop: 10 }} onClick={submitPost}>Post to the board</button>
        </div>
      )}

      <div className="stats">
        <div className="stat"><span>Wins this week</span><b>{board.stats.wins}</b></div>
        <div className="stat"><span>On the road</span><b>{board.stats.onRoad}</b></div>
        <div className="stat"><span>In the office</span><b>{board.stats.inOffice}</b></div>
        <div className="stat"><span>Open flags</span><b>{board.stats.openFlags}</b></div>
      </div>

      <button type="button" className="card home-card home-celebrate-alert" onClick={() => setCelebrateOn(true)}>
        <div>
          <strong>Birthdays / Anniversaries</strong>
          <div className="muted">Yesterday / today / tomorrow · America/Chicago</div>
        </div>
        <span className="chip on">birthdays / anniversaries</span>
      </button>

      <div className="home-grid">
        <article className="card mod home-card home-update accent-update">
          <FeaturedPost
            post={featuredUpdate}
            kind="update"
            toast={toast}
            onChange={load}
            onAdd={() => setCompose({ type: "update" })}
            onEdit={featuredUpdate ? () => setCompose({ type: "edit", post: featuredUpdate }) : undefined}
          />
        </article>

        <article className="card mod home-card home-star accent-star">
          <div className="mod-h">
            <h2>Star of the day</h2>
            <button type="button" className="btn s" onClick={() => setCompose({ type: "star" })}>+</button>
          </div>
          {board.starOfDay ? (
            <>
              <p><strong>@{firstName(starTo)}</strong> — {board.starOfDay.body}</p>
              <p className="muted" style={{ marginTop: 6 }}>{starFrom || "This week"}{starFrom ? " · this week" : ""}</p>
            </>
          ) : (
            <p className="muted">No star yet this week. One deed = one star.</p>
          )}
        </article>

        <article className="card mod home-card home-kudos accent-kudos">
          <div className="mod-h">
            <h2>Kudos</h2>
            <div className="home-card-actions">
              <button type="button" className="btn s" onClick={() => setCompose({ type: "kudos" })}>+</button>
              <Link className="btn s" to="/kudos">All</Link>
            </div>
          </div>
          {board.kudosTop.length === 0 && <p className="muted">No stars this week yet. One deed = one star.</p>}
          {board.kudosTop.length > 0 && (
            <div className="podium">
              <PodiumSlot place={2} row={second} />
              <PodiumSlot place={1} row={first} />
              <PodiumSlot place={3} row={third} />
            </div>
          )}
        </article>

        <article className="card mod home-card home-mentions accent-mentions">
          <div className="mod-h">
            <h2>Mentions</h2>
            <div className="home-card-actions">
              <button type="button" className="btn s" onClick={() => setCompose({ type: "mention" })}>+</button>
              <Link className="btn s" to="/mentions">Inbox</Link>
            </div>
          </div>
          {board.mentions.length === 0 && <p className="muted">No @mentions this week.</p>}
          {board.mentions.map(m => (
            <div className="bar-row" key={m.userId}>
              <span>@{firstName(m.name)}</span>
              <div className="bar"><i style={{ width: `${Math.round((m.count / maxMentions) * 100)}%` }} /></div>
              <span>{m.count}</span>
            </div>
          ))}
        </article>

        <article className="card mod home-card home-feed accent-win">
          <div className="mod-h">
            <h2>Win Board</h2>
            <button type="button" className="btn s" onClick={() => setCompose({ type: "win" })}>Add a win</button>
          </div>
          {board.posts.length === 0 && <p className="muted">Nothing on the Win Board yet.</p>}
          {board.posts.map(p => (
            <button type="button" className="row board-row" key={p.id} onClick={() => setOpenId(p.id)}>
              <div>
                <strong>{p.kind === "win" ? "Win" : "Note"} · {p.title}</strong>
                <div className="muted">This week · {p.author || "Shop"} · {chiShort(p.createdAt)}</div>
              </div>
              <span className={"chip" + (p.kind === "win" ? " on" : "")}>{p.kind === "win" ? "Win" : "Update"}</span>
            </button>
          ))}
        </article>
      </div>

      {celebrateOn && (
        <div className="dlg-scrim" onClick={() => setCelebrateOn(false)}>
          <article className="card mod home-card dlg" onClick={e => e.stopPropagation()}>
            <div className="mod-h">
              <h2>Birthdays / Anniversaries</h2>
              <button type="button" className="btn s" onClick={() => setCelebrateOn(false)}>Close</button>
            </div>
            <p className="muted" style={{ marginBottom: 10 }}>Yesterday / today / tomorrow · America/Chicago</p>
            {celebrations.length === 0 && <p className="muted">Nobody in the window.</p>}
            {celebrations.map(row => (
              <div className="row" key={`${row.kind}-${row.id}`}>
                <div>
                  <strong>{row.name}</strong>
                  <div className="muted">{row.kind === "anniversary" ? "Work Anniversary" : "Birthday"}</div>
                </div>
                <span className="chip on">{row.kind === "anniversary" ? "Work Anniversary" : "Birthday"}</span>
              </div>
            ))}
          </article>
        </div>
      )}

      {openPost && (
        <div className="dlg-scrim" onClick={() => setOpenId(null)}>
          <article className="card mod home-card dlg" onClick={e => e.stopPropagation()}>
            <PostDetail post={openPost} toast={toast} onChange={load} onClose={() => setOpenId(null)} />
          </article>
        </div>
      )}

      {compose && (
        <div className="dlg-scrim" onClick={() => setCompose(null)}>
          <article className="card mod home-card dlg" onClick={e => e.stopPropagation()}>
            <ComposePanel
              compose={compose}
              team={team}
              toast={toast}
              onClose={() => setCompose(null)}
              onDone={() => { setCompose(null); load(); }}
            />
          </article>
        </div>
      )}
    </section>
  );
}

function ComposePanel({ compose, team, toast, onClose, onDone }: {
  compose: Compose; team: TeamLite[]; toast: ToastFn; onClose: () => void; onDone: () => void;
}) {
  const [title, setTitle] = useState(compose.type === "edit" ? (compose.post.title || "") : "");
  const [body, setBody] = useState(compose.type === "edit" ? compose.post.body : "");
  const [to, setTo] = useState(team[0]?.id || "");

  useEffect(() => {
    if (!to && team[0]) setTo(team[0].id);
  }, [team, to]);

  const heading =
    compose.type === "win" ? "Add a win"
    : compose.type === "update" ? "Add"
    : compose.type === "edit" ? "edit"
    : compose.type === "star" ? "Star of the day"
    : compose.type === "kudos" ? "Kudos"
    : "Mentions";

  const submit = async () => {
    try {
      if (compose.type === "win" || compose.type === "update") {
        if (!title.trim() || !body.trim()) { toast("Title and body needed"); return; }
        await api("/api/posts", { method: "POST", body: JSON.stringify({ kind: compose.type, title, body }) });
        toast(compose.type === "win" ? "Win posted" : "Update posted");
      } else if (compose.type === "edit") {
        if (!title.trim() || !body.trim()) { toast("Title and body needed"); return; }
        await api(`/api/posts/${compose.post.id}`, { method: "PUT", body: JSON.stringify({ title, body }) });
        toast("Update saved");
      } else if (compose.type === "kudos" || compose.type === "star") {
        if (!to) { toast("Pick a teammate"); return; }
        if (!body.trim()) { toast("Name the thing they did"); return; }
        await api("/api/kudos", { method: "POST", body: JSON.stringify({ toUserId: to, body }) });
        toast(compose.type === "star" ? "Star set" : "Star given");
      } else {
        if (!to) { toast("Pick a teammate"); return; }
        if (!body.trim()) { toast("Write the mention"); return; }
        await api("/api/mentions", { method: "POST", body: JSON.stringify({ userId: to, snippet: body }) });
        toast("Mention added");
      }
      onDone();
    } catch (e) { toast((e as Error).message); }
  };

  const action =
    compose.type === "win" ? "Add a win"
    : compose.type === "update" ? "Add"
    : compose.type === "edit" ? "edit"
    : "+";

  const personForm = compose.type === "kudos" || compose.type === "star" || compose.type === "mention";

  return (
    <>
      <div className="mod-h">
        <h2>{heading}</h2>
        <button type="button" className="btn s" onClick={onClose}>Close</button>
      </div>
      {personForm && (
        <>
          <label className="muted">To</label>
          <select className="sel" style={{ width: "100%", margin: "6px 0 12px" }} value={to} onChange={e => setTo(e.target.value)}>
            {team.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </>
      )}
      {!personForm && (
        <input className="sel" style={{ width: "100%", margin: "0 0 10px" }} placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
      )}
      <textarea
        className="compose"
        placeholder={personForm
          ? (compose.type === "mention" ? "What you want them to see." : "One thing they did")
          : "What happened? @Name mentions land in the inbox."}
        value={body}
        onChange={e => setBody(e.target.value)}
      />
      <button className="btn p" style={{ marginTop: 10 }} onClick={submit}>{action}</button>
    </>
  );
}

function PostDetail({ post, toast, onChange, onClose }: { post: HomePost; toast: ToastFn; onChange: () => void; onClose: () => void }) {
  const [draft, setDraft] = useState("");
  const win = post.kind === "win";
  const comment = async () => {
    if (!draft.trim()) { toast("Write a comment"); return; }
    try {
      await api(`/api/posts/${post.id}/comments`, { method: "POST", body: JSON.stringify({ body: draft }) });
      toast("Comment added");
      setDraft("");
      onChange();
    } catch (e) { toast((e as Error).message); }
  };
  const thumb = async () => {
    try {
      await api(`/api/posts/${post.id}/thumbs`, { method: "POST" });
      onChange();
    } catch (e) { toast((e as Error).message); }
  };
  return (
    <>
      <div className="mod-h">
        <h2>{win ? "Win" : "Update"}</h2>
        <button type="button" className="btn s" onClick={onClose}>Close</button>
      </div>
      <p className={win ? "hero" : undefined}>{win ? post.title : <strong>{post.title}</strong>}</p>
      <p className="muted" style={{ margin: "6px 0 10px" }}>This week · {post.author || "Shop"} · {chiShort(post.createdAt)}</p>
      <p className="note">{mention(post.body)}</p>
      <p className="muted" style={{ margin: "10px 0 0" }}>Thumbs · {post.thumbs ?? 0}</p>
      {post.comments.map(c => (
        <div className="comment" key={c.id}><strong>{c.author || "Shop"}</strong> · {mention(c.body)}</div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <input className="sel" style={{ flex: 1, minWidth: 160 }} placeholder="Comment · @Name mentions count" value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") comment(); }} />
        <button className="btn s" onClick={comment}>Comment</button>
        <button className="btn s" onClick={thumb}>Thumbs</button>
      </div>
    </>
  );
}

function FeaturedPost({ post, kind, toast, onChange, onAdd, onEdit }: {
  post?: HomePost; kind: "win" | "update"; toast: ToastFn; onChange: () => void; onAdd?: () => void; onEdit?: () => void;
}) {
  const [draft, setDraft] = useState("");
  const win = kind === "win";
  const comment = async () => {
    if (!post) return;
    if (!draft.trim()) { toast("Write a comment"); return; }
    try {
      await api(`/api/posts/${post.id}/comments`, { method: "POST", body: JSON.stringify({ body: draft }) });
      toast("Comment added");
      setDraft("");
      onChange();
    } catch (e) { toast((e as Error).message); }
  };
  return (
    <>
      <div className="mod-h">
        <h2>{win ? "Win" : "Update"}</h2>
        <div className="home-card-actions">
          {!win && <button type="button" className="btn s" onClick={onAdd}>Add</button>}
          {!win && post && <button type="button" className="btn s" onClick={onEdit}>edit</button>}
          {post && <span className={"chip" + (win ? " on" : "")}>{post.author || "Shop"}</span>}
        </div>
      </div>
      {!post && <p className="muted">{win ? "No win posted this week yet." : "No update this week."}</p>}
      {post && (
        <>
          {win ? <p className="hero">{post.title}</p> : <p><strong>{post.title}</strong></p>}
          <p className="muted" style={{ margin: "6px 0 10px" }}>This week · {post.author || "Shop"} · {chiShort(post.createdAt)}</p>
          <p className="note">{mention(post.body)}</p>
          {post.comments.map(c => (
            <div className="comment" key={c.id}><strong>{c.author || "Shop"}</strong> · {mention(c.body)}</div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <input className="sel" style={{ flex: 1, minWidth: 160 }} placeholder="Comment · @Name mentions count" value={draft} onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") comment(); }} />
            <button className="btn s" onClick={comment}>Comment</button>
          </div>
        </>
      )}
    </>
  );
}

function PodiumSlot({ place, row }: { place: number; row?: HomeBoard["kudosTop"][number] }) {
  if (!row) return <div />;
  return (
    <div className={"p" + (place === 1 ? " p1" : "")}>
      <div className="place">{place}</div>
      <div className="av" style={{ background: row.avatarColor || "#1c332c", margin: "8px auto" }}>{row.initials}</div>
      <strong>{firstName(row.name || "—")}</strong>
      <div className="muted">{row.stars} ★</div>
    </div>
  );
}

function chiShort(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { timeZone: "America/Chicago", weekday: "short" });
}

function weekRange(start: string, end: string, fallback: string) {
  const s = parseDateOnly(start);
  const e = parseDateOnly(end);
  if (!s || !e) return fallback;
  const left = s.toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const right = e.getUTCMonth() === s.getUTCMonth()
    ? String(e.getUTCDate())
    : e.toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${left}–${right} · America/Chicago`;
}

function parseDateOnly(value?: string) {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}
