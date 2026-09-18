/**
 * Home / Clients / Flags DTO contracts for Dev2.
 * Live JSON matches these types. OpenAPI: GET http://localhost:5080/swagger
 * Seed Murray Media id: 66666666-6666-6666-6666-666666666601
 */

export type HomeBoard = {
  weekStart: string;
  weekEnd: string;
  weekLabel: string;
  tz: "America/Chicago";
  stats: { wins: number; onRoad: number; inOffice: number; openFlags: number };
  posts: HomePost[];
  starOfDay: { to?: string; body: string; from: string } | null;
  mentions: { userId: string; name: string; count: number }[];
  kudosTop: { userId: string; name?: string; initials: string; avatarColor?: string; stars: number }[];
  birthdays: { id: string; name: string; initials: string }[];
  anniversaries: { id: string; name: string; initials: string }[];
  celebrations: { id: string; name: string; initials: string; kind: "birthday" | "anniversary" | string }[];
};

export type HomePost = {
  id: string;
  kind: "win" | "update" | string;
  title: string;
  body: string;
  createdAt: string;
  weekStart: string;
  author?: string;
  comments: { id: string; body: string; author?: string; createdAt: string }[];
  thumbs: number;
};

export type ClientListRow = {
  id: string;
  name: string;
  industry?: string;
  status: string;
  county?: string;
  primary?: string;
  address?: string;
  contractEnd?: string;
  businessPhone?: string;
  businessEmail?: string;
  website?: string;
};

export type ClientFile = {
  id: string;
  name: string;
  industry?: string;
  status: string;
  county?: string;
  businessPhone?: string;
  businessEmail?: string;
  website?: string;
  /** Business actions — NEVER a person (not “Call Bre”). */
  business: {
    call?: string;
    email?: string;
    map?: string;
    mapLabel?: string;
    website?: string;
  };
  customFields?: Record<string, unknown>;
  people: {
    id: string;
    name: string;
    title?: string;
    department?: string;
    email?: string;
    phone?: string;
    pinned: boolean;
    primary: boolean;
    initials: string;
    avatarColor?: string;
  }[];
  addresses: {
    id: string;
    label: string;
    line1?: string;
    city?: string;
    state?: string;
    zip?: string;
    county?: string;
    hours?: string;
    isPrimary: boolean;
    phone?: string;
    maps: string;
  }[];
  services: { id: string; serviceTypeId?: string; name?: string; on: boolean; note?: string }[];
  links: { id: string; label: string; url: string }[];
  vendors: { id: string; kind: string; name: string; phone?: string }[];
  /** secret is always "••••••••" until POST …/reveal */
  vault: { id: string; department: string; title: string; username?: string; secret: string; url?: string; note?: string }[];
  flags: { id: string; body: string; createdAt: string; level?: string; color?: string; on: string; createdBy?: string }[];
  files: { id: string; name: string; kind: string; mime: string; bytes: number }[];
  notes: { id: string; body: string; author?: string; createdAt: string }[];
  updatedAt?: string;
  print?: { notice: string; omitVault: true; omitCare: true } | null;
};

export type FlagRow = {
  id: string;
  body: string;
  createdAt: string;
  archivedAt?: string;
  purgeAt?: string;
  daysLeft?: number | null;
  level?: string;
  color?: string;
  on: string;
  clientId: string;
  client?: string;
  createdById: string;
  createdBy?: string;
};

export type Lookups = {
  departments: { id: string; name: string }[];
  counties: string[];
  services: { id: string; name?: string; description?: string }[];
  flagLevels: { id: string; name: string; color?: string; description?: string }[];
  customFields?: { id: string; name: string; type?: string }[];
  product?: string;
};

export const HomeClientsFlagsApi = {
  home: "GET /api/home",
  clients: "GET /api/clients?industry=&county=&status=&q=&service=",
  createClient: "POST /api/clients  { name, industry?, status?, county?, businessPhone?, businessEmail?, website? }",
  updateClient: "PUT /api/clients/{id}  { name?, industry?, status?, county?, businessPhone?, businessEmail?, website? }",
  clientFile: "GET /api/clients/{id}",
  print: "GET /api/clients/{id}/print  (no vault, no care flags)",
  addPerson: "POST /api/clients/{id}/people",
  editPerson: "PUT /api/clients/{id}/people/{personId}",
  pinPerson: "POST /api/clients/{id}/people/{personId}/pin  { pinned }",
  addAddress: "POST /api/clients/{id}/addresses",
  editAddress: "PUT /api/clients/{id}/addresses/{addressId}",
  addService: "POST /api/clients/{id}/services  { serviceTypeId, on?, note? }",
  editService: "PUT /api/clients/{id}/services/{serviceId}  { serviceTypeId?, on?, note? }",
  removeService: "DELETE /api/clients/{id}/services/{serviceId}",
  addLink: "POST /api/clients/{id}/links  { label, url }",
  editLink: "PUT /api/clients/{id}/links/{linkId}",
  removeLink: "DELETE /api/clients/{id}/links/{linkId}",
  addVendor: "POST /api/clients/{id}/vendors  { kind, name, phone? }",
  editVendor: "PUT /api/clients/{id}/vendors/{vendorId}",
  removeVendor: "DELETE /api/clients/{id}/vendors/{vendorId}",
  addWinOrUpdate: "POST /api/posts  { kind: win|update, title, body }  Admin only",
  editPost: "PUT /api/posts/{id}  { title?, body? }  Admin only",
  addKudos: "POST /api/kudos  { toUserId, body }",
  addMention: "POST /api/mentions  { userId, snippet }",
  addNote: "POST /api/clients/{id}/notes  { body }  (@Name creates a mention)",
  addCatalogService: "POST /api/admin/services  { name, description? }  Admin only",
  vaultList: "GET /api/clients/{id}/vault  (masked)",
  vaultAdd: "POST /api/clients/{id}/vault  { department, title, username?, secret, url?, note? }",
  vaultReveal: "POST /api/clients/{id}/vault/{credId}/reveal  → { secret }  (human staff only)",
  upload: "POST /api/clients/{id}/files  multipart field=file",
  flags: "GET /api/flags?state=open|archived&clientId=&levelId=",
  addFlag: "POST /api/flags  { clientId, levelId, body, personId? }",
  archiveFlag: "POST /api/flags/{id}/archive  → purgeAt = now+90d",
  restoreFlag: "POST /api/flags/{id}/restore",
  lookups: "GET /api/lookups  → counties, flagLevels, services, departments",
  myTime: "GET /api/time?from=&to=&q=  (q = search notes)",
  audit: "GET /api/audit?from=&to=&q=&action=&actor=&objectType=",
  mentions: "GET /api/mentions?name=&from=&to=",
  kudos: "GET /api/kudos?name=&from=&to=",
  reports: "GET /api/reports?from=&to=",
  reportsPdf: "GET /api/reports/pdf?from=&to=  (no vault)",
} as const;

export const MURRAY_MEDIA_ID = "66666666-6666-6666-6666-666666666601";
