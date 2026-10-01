export type Kpi = {
  label: string;
  value: number;
  alert?: boolean;
  spark: number[];
};

export type FlagTone = "warn" | "care" | "note";

export type OpenFlag = {
  client: string;
  level: string;
  tone: FlagTone;
  note: string;
};

export type WeekBoard = {
  kpis: Kpi[];
  hours: { day: string; hours: number }[];
  flagTypes: { label: string; value: number; color: string }[];
  flags: OpenFlag[];
};

export type ClientRow = {
  id: string;
  name: string;
  primary: string;
  services: string;
  status: "Active" | "Prospect";
  file: boolean;
};

export const thisWeek: WeekBoard = {
  kpis: [
    { label: "Wins", value: 7, spark: [2, 3, 2, 4, 5, 6, 7] },
    { label: "On the road", value: 1, spark: [0, 1, 2, 1, 0, 1, 1] },
    { label: "In office", value: 1, spark: [2, 2, 1, 2, 1, 1, 1] },
    { label: "Open flags", value: 3, alert: true, spark: [1, 2, 2, 3, 2, 3, 3] }
  ],
  hours: [
    { day: "Mon", hours: 6 },
    { day: "Tue", hours: 8 },
    { day: "Wed", hours: 7 },
    { day: "Thu", hours: 5 },
    { day: "Fri", hours: 4 }
  ],
  flagTypes: [
    { label: "Warning", value: 1, color: "#E15D4A" },
    { label: "Care", value: 1, color: "#E3A04A" },
    { label: "Note", value: 1, color: "#4F46E5" }
  ],
  flags: [
    { client: "Northstar", level: "Warning", tone: "warn", note: "Do not restart the server during the day." },
    { client: "Lakeside", level: "Care", tone: "care", note: "Keep this visit light." },
    { client: "Murray Media", level: "Note", tone: "note", note: "Ask before touching the studio NAS." }
  ]
};

export const lastWeek: WeekBoard = {
  kpis: [
    { label: "Wins", value: 4, spark: [1, 1, 2, 2, 3, 3, 4] },
    { label: "On the road", value: 2, spark: [1, 2, 1, 2, 2, 1, 2] },
    { label: "In office", value: 2, spark: [1, 1, 2, 2, 1, 2, 2] },
    { label: "Open flags", value: 1, alert: true, spark: [2, 2, 1, 1, 1, 1, 1] }
  ],
  hours: [
    { day: "Mon", hours: 5 },
    { day: "Tue", hours: 6 },
    { day: "Wed", hours: 4 },
    { day: "Thu", hours: 7 },
    { day: "Fri", hours: 3 }
  ],
  flagTypes: [
    { label: "Care", value: 1, color: "#E3A04A" }
  ],
  flags: [
    { client: "Lakeside", level: "Care", tone: "care", note: "Keep this visit light." }
  ]
};

export const clients: ClientRow[] = [
  { id: "murray-media", name: "Murray Media", primary: "Bre", services: "Managed IT, Microsoft 365", status: "Active", file: true },
  { id: "northstar", name: "Northstar", primary: "Priya Shah", services: "Managed IT", status: "Active", file: false },
  { id: "lakeside", name: "Lakeside", primary: "—", services: "—", status: "Active", file: false },
  { id: "oak-iron", name: "Oak + Iron Realty", primary: "James Oak", services: "—", status: "Active", file: false },
  { id: "harbor", name: "Harbor Kids Academy", primary: "—", services: "—", status: "Prospect", file: false }
];

export const murrayFile = {
  name: "Murray Media",
  phone: "(214) 555-2500",
  email: "info@murraymedia.example",
  flagSummary: "2 flags · Warning, Care.",
  flags: [
    { level: "Warning", tone: "warn" as FlagTone, body: "Do not shut the studio servers down during the day." },
    { level: "Care", tone: "care" as FlagTone, body: "Keep visits with Scott light this week." }
  ],
  people: [
    { name: "Bre", title: "Owner", department: "Operations", pinned: true, primary: true },
    { name: "Scott", title: "Studio IT", department: "IT", pinned: false, primary: false },
    { name: "Jordan Hale", title: "IT", department: "IT", pinned: false, primary: false },
    { name: "Ronnie", title: "Designer", department: "Digital", pinned: false, primary: false },
    { name: "Ana Ruiz", title: "Designer", department: "Digital", pinned: false, primary: false }
  ],
  services: [
    { name: "Managed IT", state: "On" },
    { name: "Microsoft 365", state: "On" }
  ]
};

/** Masked vault row. The secret cell is only the mask — never a real value. */
export const vaultRow = {
  item: "Studio NAS",
  username: "scott",
  secret: "••••••••"
};
