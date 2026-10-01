import { useState } from "react";
import { Link } from "react-router-dom";
import { lastWeek, thisWeek, type OpenFlag, type WeekBoard } from "../sampleData";
import { ClientTable } from "./Clients";

const TABS = [
  { id: "this", label: "This week" },
  { id: "last", label: "Last week" },
  { id: "clients", label: "Clients" }
] as const;

type TabId = (typeof TABS)[number]["id"];

export function Home() {
  const [tab, setTab] = useState<TabId>("this");
  const board = tab === "last" ? lastWeek : thisWeek;

  return (
    <section className="page">
      <h1 className="page-title">Home</h1>
      <div className="tabs" role="tablist" aria-label="Home">
        {TABS.map(item => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={"tab" + (tab === item.id ? " on" : "")}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "clients" ? (
        <ClientTable />
      ) : (
        <WeekView board={board} />
      )}
    </section>
  );
}

function WeekView({ board }: { board: WeekBoard }) {
  return (
    <>
      <div className="kpi-row">
        {board.kpis.map(kpi => (
          <article className="tile" key={kpi.label}>
            <div className="tile-top">
              <span className="tile-label">{kpi.label}</span>
              <Spark points={kpi.spark} alert={kpi.alert} />
            </div>
            <p className={"kpi-value" + (kpi.alert ? " alert" : "")}>{kpi.value}</p>
          </article>
        ))}
      </div>

      <div className="split">
        <article className="card chart-card">
          <h2>Clocked hours</h2>
          <p className="muted">Mon–Fri</p>
          <HoursChart hours={board.hours} />
        </article>
        <article className="card chart-card">
          <h2>Flags by type</h2>
          <Donut parts={board.flagTypes} />
        </article>
      </div>

      <article className="card flag-card">
        <h2>Open flags</h2>
        <ul className="flag-list">
          {board.flags.map(flag => (
            <FlagLine key={flag.client + flag.level} flag={flag} />
          ))}
        </ul>
      </article>
    </>
  );
}

function FlagLine({ flag }: { flag: OpenFlag }) {
  const name = flag.client === "Murray Media"
    ? <Link to="/clients/murray-media">{flag.client}</Link>
    : <strong>{flag.client}</strong>;
  return (
    <li className="flag-line">
      <div>
        {name}
        <p className="muted">{flag.note}</p>
      </div>
      <span className={"chip " + flag.tone}>{flag.level}</span>
    </li>
  );
}

function Spark({ points, alert }: { points: number[]; alert?: boolean }) {
  const w = 72;
  const h = 28;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const d = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - 3 - ((p - min) / span) * (h - 6);
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={d} fill="none" stroke={alert ? "#E15D4A" : "#4F46E5"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HoursChart({ hours }: { hours: WeekBoard["hours"] }) {
  const peak = Math.max(...hours.map(h => h.hours), 1);
  return (
    <div className="bars" role="img" aria-label="Clocked hours Monday through Friday">
      {hours.map(row => (
        <div className="bar-col" key={row.day}>
          <span className="bar-num">{row.hours}</span>
          <div className="bar-track">
            <i style={{ height: `${Math.round((row.hours / peak) * 100)}%` }} />
          </div>
          <span className="bar-day">{row.day}</span>
        </div>
      ))}
    </div>
  );
}

function Donut({ parts }: { parts: WeekBoard["flagTypes"] }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0) || 1;
  const r = 36;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="donut-row">
      <svg className="donut" viewBox="0 0 100 100" role="img" aria-label="Flags by type">
        <g className="donut-ring">
        {parts.map(part => {
          const dash = (part.value / total) * c;
          const rot = (acc / total) * 360;
          acc += part.value;
          return (
            <circle
              key={part.label}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={part.color}
              strokeWidth="12"
              strokeDasharray={parts.length === 1 ? undefined : `${dash} ${c - dash}`}
              transform={`rotate(${rot} 50 50)`}
            />
          );
        })}
        </g>
        <text x="50" y="54" textAnchor="middle" className="donut-total">{total}</text>
      </svg>
      <ul className="legend">
        {parts.map(part => (
          <li key={part.label}>
            <i style={{ background: part.color }} />
            {part.label}
            <span>{part.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
