import { useEffect, useRef, useState } from "react";
import { api, type User } from "../api";

export const SHOUT_PRESETS = ["Good morning", "High five", "Congratulations"] as const;
export const SHOUT_EMOJIS = ["😊", "🙌", "⭐", "🎉"] as const;
const MAX_TEXT = 80;
const TOAST_MS = 6000;
const POLL_MS = 4000;

export type ShoutItem = {
  id: string;
  preset?: string | null;
  emoji?: string | null;
  text?: string | null;
  message: string;
  from: string;
  fromUserId: string;
  createdAt: string;
};

export type ShoutFeed = {
  items: ShoutItem[];
  canSend: boolean;
  cooldownSeconds: number;
  waitLabel?: string | null;
};

type ToastFn = (m: string) => void;

function waitCopy(seconds: number) {
  const s = Math.max(0, Math.ceil(seconds));
  return `Wait ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function useShoutoutFeed(user: User | null, onToast: (item: ShoutItem) => void) {
  const [cooldown, setCooldown] = useState(0);
  const [canSend, setCanSend] = useState(!!user && (user.role === "admin" || !!user.dashboardAdmin));
  const afterRef = useRef(new Date().toISOString());
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (!user) return;
    afterRef.current = new Date().toISOString();
    let on = true;
    const tick = async () => {
      try {
        const feed = await api<ShoutFeed>("/api/shoutouts?after=" + encodeURIComponent(afterRef.current));
        if (!on) return;
        setCanSend(feed.canSend);
        setCooldown(feed.cooldownSeconds);
        for (const item of feed.items) {
          if (seen.current.has(item.id)) continue;
          seen.current.add(item.id);
          afterRef.current = item.createdAt;
          onToast(item);
        }
      } catch { /* keep polling */ }
    };
    void tick();
    const id = window.setInterval(tick, POLL_MS);
    const cd = window.setInterval(() => setCooldown(v => (v > 0 ? v - 1 : 0)), 1000);
    return () => { on = false; window.clearInterval(id); window.clearInterval(cd); };
  }, [user?.id]);

  return { cooldown, canSend, setCooldown, setCanSend };
}

export function ShoutoutButton({
  user, toast, cooldown, setCooldown
}: {
  user: User; toast: ToastFn; cooldown: number; setCooldown: (n: number) => void;
}) {
  const admin = user.role === "admin" || !!user.dashboardAdmin;
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  if (!admin) return null;

  return (
    <div className="shout-wrap" ref={wrap}>
      <button type="button" className="btn shout" onClick={() => setOpen(v => !v)}>Shoutout</button>
      {open && (
        <ShoutoutComposer
          toast={toast}
          cooldown={cooldown}
          onSent={(seconds) => { setCooldown(seconds); setOpen(false); }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function ShoutoutComposer({
  toast, cooldown, onSent, onClose
}: {
  toast: ToastFn; cooldown: number; onSent: (seconds: number) => void; onClose: () => void;
}) {
  const [preset, setPreset] = useState<string>("High five");
  const [emoji, setEmoji] = useState<string>("🙌");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const cooling = cooldown > 0;

  const send = async () => {
    if (cooling || busy) return;
    if (!preset && !emoji && !text.trim()) { toast("Pick a preset or emoji"); return; }
    setBusy(true);
    try {
      const r = await api<{ cooldownSeconds: number }>("/api/shoutouts", {
        method: "POST",
        body: JSON.stringify({ preset: preset || null, emoji: emoji || null, text: text.trim() || null })
      });
      onSent(r.cooldownSeconds ?? 300);
    } catch (e) {
      const err = e as Error & { status?: number };
      toast(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="composer-stage" role="region" aria-label="Shoutout">
      <div className="composer-chrome">
        <span className="ttl">Shoutout</span>
        <button type="button" className="x" onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className="composer-body">
        <div className="lab">Preset</div>
        <div className="presets">
          {SHOUT_PRESETS.map(p => (
            <button key={p} type="button" className={"preset" + (preset === p ? " on" : "")} onClick={() => setPreset(preset === p ? "" : p)}>{p}</button>
          ))}
        </div>
        <div className="lab">Emoji</div>
        <div className="emoji-row">
          {SHOUT_EMOJIS.map(e => (
            <button key={e} type="button" className={"emoji" + (emoji === e ? " on" : "")} onClick={() => setEmoji(emoji === e ? "" : e)}>{e}</button>
          ))}
        </div>
        <div className="lab">Optional text</div>
        <div className="field-wrap">
          <textarea
            maxLength={MAX_TEXT}
            value={text}
            onChange={e => setText(e.target.value.slice(0, MAX_TEXT))}
            placeholder="Nice week so far"
            aria-label="Optional shoutout text"
          />
          <span className="counter">{text.length} / {MAX_TEXT}</span>
        </div>
        <div className="composer-actions">
          <button type="button" className="btn p" disabled={cooling || busy} onClick={send}>Send</button>
          {cooling && <button type="button" className="btn wait s" disabled title="1 shoutout / 5 min">{waitCopy(cooldown)}</button>}
          <span className="note">No sound · soft toast</span>
        </div>
      </div>
    </div>
  );
}

export function ShoutoutToast({ item, onDone }: { item: ShoutItem | null; onDone: () => void }) {
  useEffect(() => {
    if (!item) return;
    const t = window.setTimeout(onDone, TOAST_MS);
    return () => window.clearTimeout(t);
  }, [item?.id]);

  if (!item) return null;
  return (
    <div className="shout-toast" role="status" aria-live="polite" aria-atomic="true">
      <div className="row1">
        <span className="ico" aria-hidden="true">{item.emoji || "🎉"}</span>
        <div>
          <div className="msg">{item.message}</div>
          <div className="from">from {item.from}</div>
        </div>
      </div>
    </div>
  );
}
