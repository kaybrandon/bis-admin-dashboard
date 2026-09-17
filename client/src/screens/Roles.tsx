import { useEffect, useState } from "react";
import { api, type User } from "../api";

export type RoleRow = {
  id: string;
  name: string;
  email: string;
  initials: string;
  avatarColor: string;
  dashboardAdmin: boolean;
  isGlobalAdmin: boolean;
};

type ToastFn = (m: string) => void;

export function RolesPage({ user, toast }: { user: User; toast: ToastFn }) {
  const [rows, setRows] = useState<RoleRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const global = !!user.isGlobalAdmin;

  const load = () => api<RoleRow[]>("/api/roles").then(setRows);

  useEffect(() => { load().catch(() => toast("Could not load roles")); }, []);

  const flip = async (row: RoleRow, grant: boolean) => {
    if (!global) { toast("Global Admin only"); return; }
    if (row.id === user.id) { toast("You cannot change your own role"); return; }
    setBusy(row.id);
    try {
      const path = grant ? `/api/roles/${row.id}/grant` : `/api/roles/${row.id}/revoke`;
      const saved = await api<RoleRow>(path, { method: "POST" });
      setRows(cur => cur.map(r => r.id === saved.id ? saved : r));
      toast(grant ? `Granted · ${row.name.split(" ")[0]}` : `Revoked · ${row.name.split(" ")[0]}`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="card roles-card">
      <div className="card-h">
        <h2>People</h2>
        <span className="hint">Dense table · Admin chip when grant is On</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Dashboard administrator</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const self = row.id === user.id;
              const locked = !global || self || (row.isGlobalAdmin && row.dashboardAdmin);
              return (
                <tr key={row.id}>
                  <td>
                    <div className="name-cell">
                      <span className="av" style={{ background: row.avatarColor }}>{row.initials}</span>
                      <strong>{row.name}</strong>
                      {row.dashboardAdmin && <span className="chip-admin">Admin</span>}
                    </div>
                  </td>
                  <td className="email">{row.email}</td>
                  <td>
                    {row.dashboardAdmin ? (
                      <button
                        type="button"
                        className="btn s"
                        disabled={locked || busy === row.id}
                        onClick={() => flip(row, false)}
                      >Revoke</button>
                    ) : (
                      <button
                        type="button"
                        className={"btn s" + (locked ? "" : " p")}
                        disabled={locked || busy === row.id}
                        onClick={() => flip(row, true)}
                      >Grant</button>
                    )}
                  </td>
                  <td className="muted">{row.isGlobalAdmin ? "Global Admin" : self && global ? "You" : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="gate">
        <strong>Gate:</strong> only Global Admin can Grant / Revoke. Staff without Dashboard administrator never see Shoutout.
      </div>
    </div>
  );
}
