import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type User } from "../api";
import type { HomeBoard, HomePost } from "../contracts";
import { firstName, hourWord, mention } from "../screenUtil";

type ToastFn = (m: string) => void;
type TeamLite = { id: string; name: string };

export function Home({ user, toast }: { user: User; toast: ToastFn }) {
  const [board, setBoard] = useState<HomeBoard | null>(null);
  const [team, setTeam] = useState<TeamLite[]>([]);
  const [err, setErr] = useState("");
  const [postOn, setPostOn] = useState(false);
  const [kind, setKind] = useState("win");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
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

  if (err) return <p className="err">{err}</p>;
  if (!board) return <p>Loading team board…</p>;

  const wins = board.posts.filter(p => p.kind === "win");
  const updates = board.posts.filter(p => p.kind === "update");
  const featuredWin = wins[0];
  const featuredUpdate = updates[0];
  const maxMentions = Math.max(1, ...board.mentions.map(m => m.count));
  const [first, second, third] = board.kudosTop;
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

      {board.birthdays.length > 0 && (
        <div className="bday-bar">
          <div>
            <strong>Birthday window</strong>
            <div className="muted">{board.birthdays.map(b => b.name).join(" · ")} · yesterday / today / tomorrow · America/Chicago</div>
          </div>
          <span className="chip on">{board.birthdays.length === 1 ? "Today-ish" : `${board.birthdays.length} people`}</span>
        </div>
      )}

      {postOn && admin && (
        <div className="card mod" style={{ marginBottom: 14 }}>
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

      <div className="modules">
        {featuredWin && <FeaturedPost post={featuredWin} kind="win" toast={toast} onChange={load} />}
        {featuredUpdate && <FeaturedPost post={featuredUpdate} kind="update" toast={toast} onChange={load} />}
        {board.starOfDay && (
          <div className="card mod" style={{ background: "#e7f4ec", borderColor: "#b7dcc8" }}>
            <div className="mod-h"><h2>Star of the day</h2><span className="chip">This week</span></div>
            <p><strong>@{firstName(board.starOfDay.to || "teammate")}</strong> — {board.starOfDay.body}</p>
            <p className="muted" style={{ marginTop: 6 }}>{starFrom || "This week"}{starFrom ? " · this week" : ""}</p>
          </div>
        )}
        <div className="card mod">
          <div className="mod-h"><h2>Mentioned · this week</h2><Link className="btn s" to="/mentions">Inbox</Link></div>
          {board.mentions.length === 0 && <p className="muted">No @mentions this week.</p>}
          {board.mentions.map(m => (
            <div className="bar-row" key={m.userId}>
              <span>@{firstName(m.name)}</span>
              <div className="bar"><i style={{ width: `${Math.round((m.count / maxMentions) * 100)}%` }} /></div>
              <span>{m.count}</span>
            </div>
          ))}
        </div>
        <div className="card mod">
          <div className="mod-h"><h2>Kudos · this week</h2><Link className="btn s" to="/kudos">All</Link></div>
          {board.kudosTop.length === 0 && <p className="muted">No stars this week yet. One deed = one star.</p>}
          {board.kudosTop.length > 0 && (
            <div className="podium">
              <PodiumSlot place={2} row={second} />
              <PodiumSlot place={1} row={first} />
              <PodiumSlot place={3} row={third} />
            </div>
          )}
        </div>
        <div className="card mod span2">
          <div className="mod-h"><h2>Board · this week</h2><span className="muted">{board.tz}</span></div>
          {board.posts.length === 0 && <p className="muted">Nothing on the week board yet.</p>}
          {board.posts.map(p => (
            <div className="row" key={p.id}>
              <div>
                <strong>{p.kind === "win" ? "Win" : "Note"} · {p.title}</strong>
                <div className="muted">This week · {p.author || "Shop"} · {chiShort(p.createdAt)}</div>
              </div>
              <span className={"chip" + (p.kind === "win" ? " on" : "")}>{p.kind === "win" ? "Win" : "Update"}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturedPost({ post, kind, toast, onChange }: { post: HomePost; kind: "win" | "update"; toast: ToastFn; onChange: () => void }) {
  const [draft, setDraft] = useState("");
  const win = kind === "win";
  const comment = async () => {
    if (!draft.trim()) { toast("Write a comment"); return; }
    try {
      await api(`/api/posts/${post.id}/comments`, { method: "POST", body: JSON.stringify({ body: draft }) });
      toast("Comment added");
      setDraft("");
      onChange();
    } catch (e) { toast((e as Error).message); }
  };
  return (
    <div className={"card mod " + (win ? "win-card span2" : "upd-card")}>
      <div className="mod-h">
        <h2>{win ? "Win" : "Update"}</h2>
        <span className={"chip" + (win ? " on" : "")}>{post.author || "Shop"}</span>
      </div>
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
    </div>
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
