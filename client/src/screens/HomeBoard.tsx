import type { User } from "../api";
import { HomeClientsFlagsApi } from "../contracts";

type ToastFn = (m: string) => void;

/** Dev2 lane: wire the week board vs Admin_UI_Mock. Do not treat this stub as the finished screen. */
export function Home({ user }: { user: User; toast: ToastFn }) {
  const first = user.name.split(" ")[0];
  return (
    <section className="home-page">
      <div className="h">
        <div>
          <h1>Good {hourWord()}, {first}</h1>
          <p>Team board · this week · America/Chicago · Dev2 wires modules</p>
        </div>
      </div>
      <div className="card mod">
        <div className="mod-h"><h2>Home board stub</h2><span className="chip">Dev2</span></div>
        <p>GET <code>/api/home</code> — types in <code>src/contracts.ts</code> · OpenAPI at <code>/swagger</code>.</p>
        <p className="muted" style={{ marginTop: 8 }}>
          Match the mock: Win, Update, Star of the day, Mentioned, Kudos podium (1 deed = 1 star), Board.
          Week is Mon–Sun America/Chicago. Maya’s birthday is seeded in-window.
        </p>
        <p className="muted" style={{ marginTop: 8 }}>{HomeClientsFlagsApi.home}</p>
      </div>
    </section>
  );
}

function hourWord() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}
