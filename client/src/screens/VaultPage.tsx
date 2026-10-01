import { vaultRow } from "../sampleData";

export function VaultPage() {
  return (
    <section className="page">
      <h1 className="page-title">Vault</h1>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Username</th>
                <th>Secret</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>{vaultRow.item}</strong></td>
                <td>{vaultRow.username}</td>
                <td className="mask">{vaultRow.secret}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
