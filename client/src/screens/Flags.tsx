import { HomeClientsFlagsApi } from "../contracts";

type ToastFn = (m: string) => void;

/** Dev2 lane: flags list + 90-day archive vs Admin_UI_Mock. */
export function Flags({ admin }: { toast: ToastFn; admin: boolean }) {
  return (
    <section>
      <div className="h">
        <div>
          <h1>Flags</h1>
          <p>Newest first. Archive is a person-by-person call — not automatic by age. Dev2 wires this screen.</p>
        </div>
      </div>
      <div className="card mod">
        <div className="mod-h"><h2>Flags stub</h2><span className="chip">Dev2</span></div>
        <p>GET <code>/api/flags?state=open|archived</code>. Archive → 90-day hold → hard delete. Restore while in hold.</p>
        <p className="muted" style={{ marginTop: 8 }}>
          Murray Media seed has warning + care flags. Care flags stay off the print sheet.
          {admin ? " Admin export: /api/admin/export/flags" : " Staff cannot export (API 403)."}
        </p>
        <p className="muted" style={{ marginTop: 8 }}>{HomeClientsFlagsApi.flags}</p>
        <p className="muted">{HomeClientsFlagsApi.addFlag}</p>
        <p className="muted">{HomeClientsFlagsApi.archiveFlag}</p>
        <p className="muted">{HomeClientsFlagsApi.restoreFlag}</p>
      </div>
    </section>
  );
}
