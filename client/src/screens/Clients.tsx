import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { clients, murrayFile, type ClientRow } from "../sampleData";
import { EmptyPage } from "./EmptyPage";

export function Clients() {
  return (
    <section className="page">
      <h1 className="page-title">Clients</h1>
      <ClientTable />
    </section>
  );
}

export function ClientTable() {
  return (
    <div className="card">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Client</th>
              <th>Primary</th>
              <th>Services</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {clients.map(row => (
              <ClientListRow key={row.id} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ClientListRow({ row }: { row: ClientRow }) {
  return (
    <tr>
      <td>
        {row.file
          ? <Link to={"/clients/" + row.id}><strong>{row.name}</strong></Link>
          : <strong>{row.name}</strong>}
      </td>
      <td>{row.primary}</td>
      <td>{row.services}</td>
      <td><span className={"chip" + (row.status === "Active" ? " on" : "")}>{row.status}</span></td>
    </tr>
  );
}

export function ClientFile() {
  const { id } = useParams();
  const [flagsOpen, setFlagsOpen] = useState(false);
  if (id !== "murray-media") return <EmptyPage title="Clients" message="Clients is empty." />;

  const file = murrayFile;
  return (
    <section className="page client-file">
      <p className="crumb"><Link to="/clients">Clients</Link></p>
      <h1 className="page-title">{file.name}</h1>
      <div className="biz-contact">
        <span>{file.phone}</span>
        <span>{file.email}</span>
      </div>
      <div className="text-links" aria-label="Business">
        <button type="button" className="text-link">Call</button>
        <button type="button" className="text-link">Email</button>
        <button type="button" className="text-link">Map</button>
        <button type="button" className="text-link">Website</button>
      </div>
      <button
        type="button"
        className="flag-summary"
        aria-expanded={flagsOpen}
        onClick={() => setFlagsOpen(open => !open)}
      >
        {file.flagSummary}
      </button>
      {flagsOpen && (
        <ul className="file-flags">
          {file.flags.map(flag => (
            <li key={flag.level} className={"file-flag " + flag.tone}>
              <b>{flag.level}</b>
              {flag.body}
            </li>
          ))}
        </ul>
      )}

      <div className="file-grid">
        <article className="card">
          <h2>People</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Title</th>
                  <th>Department</th>
                </tr>
              </thead>
              <tbody>
                {file.people.map(person => (
                  <tr key={person.name}>
                    <td>
                      <strong>{person.name}</strong>
                      {person.pinned && person.primary && <span className="chip pin">Pinned · Primary</span>}
                    </td>
                    <td>{person.title}</td>
                    <td>{person.department}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
        <article className="card">
          <h2>Services</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Service</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {file.services.map(service => (
                  <tr key={service.name}>
                    <td>{service.name}</td>
                    <td><span className="chip on">{service.state}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  );
}
