import { Link } from "react-router-dom";
import { HomeClientsFlagsApi, MURRAY_MEDIA_ID } from "../contracts";

type ToastFn = (m: string) => void;

/** Dev2 lane: clients list + client file vs Admin_UI_Mock. */
export function Clients({ admin }: { toast: ToastFn; admin: boolean }) {
  return (
    <section>
      <div className="h">
        <div>
          <h1>Clients</h1>
          <p>Every portfolio BIS keeps · Dev2 wires this list</p>
        </div>
      </div>
      <div className="card mod">
        <div className="mod-h"><h2>Clients stub</h2><span className="chip">Dev2</span></div>
        <p>GET <code>/api/clients</code> · filters <code>industry</code> <code>county</code> <code>status</code> <code>q</code>.</p>
        <p className="muted" style={{ marginTop: 8 }}>
          Seed: Murray Media (Denton, complete), Northstar Dental, Oak + Iron Realty (Collin),
          Pecan Street Cafe, Harbor Kids Academy (prospect).
        </p>
        <p style={{ marginTop: 12 }}>
          <Link className="btn p" to={`/clients/${MURRAY_MEDIA_ID}`}>Open Murray Media file</Link>
          {admin && <span className="muted" style={{ marginLeft: 10 }}>Export is admin-only (already blocked for staff on the API).</span>}
        </p>
        <p className="muted" style={{ marginTop: 8 }}>{HomeClientsFlagsApi.clients}</p>
      </div>
    </section>
  );
}

export function ClientFile() {
  return (
    <section>
      <div className="h">
        <div>
          <h1>Client file</h1>
          <p>Dev2 wires people, addresses, services, vault, flags, files, print</p>
        </div>
      </div>
      <div className="card mod">
        <div className="mod-h"><h2>Client file stub</h2><span className="chip">Dev2</span></div>
        <p>GET <code>/api/clients/{"{id}"}</code> — <code>business.call/email/map/website</code> are the <strong>business</strong> actions, never “Call Bre”.</p>
        <p className="muted" style={{ marginTop: 8 }}>
          Vault list is masked <code>••••••••</code>. Reveal is POST …/vault/{"{credId}"}/reveal (human staff only; tokens 403).
          Print GET …/print omits vault and care flags.
        </p>
        <p className="muted" style={{ marginTop: 8 }}>{HomeClientsFlagsApi.clientFile}</p>
        <p className="muted">{HomeClientsFlagsApi.vaultReveal}</p>
        <p className="muted">{HomeClientsFlagsApi.print}</p>
      </div>
    </section>
  );
}

export function PrintSheet() {
  return (
    <section>
      <div className="h">
        <div>
          <h1>Print sheet</h1>
          <p>Dev2 · no secrets · GET /api/clients/{"{id}"}/print</p>
        </div>
      </div>
      <div className="card mod">
        <p>Print payload already omits vault and care flags. Do not render secrets if you add a print CSS pass.</p>
      </div>
    </section>
  );
}
