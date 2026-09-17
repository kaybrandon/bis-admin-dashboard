# BIS Admin Dashboard

Staff **Admin** app (client file + shop board). Product chrome is **Admin** — never Folio.

Stack (locked): **ASP.NET Core 10 API + React/Vite SPA**. No Next.js. No GIS domain code.

UI: cream page (`#f3f0ea`), sidebar `#1c332c` (184px), accent `#1c7a5c`, header 56px. Home is a 3-col week board at ≥1100px (Update/Star/Kudos · Mentions/Win Board) with cream cards + thin left accents — not a client list.

## Local run (mergeable without Azure)

Requires .NET 10 SDK and Node 20+.

```bash
chmod +x scripts/dev.sh
./scripts/dev.sh
```

- API: http://localhost:5080 (`/health`, `/api/...`, OpenAPI `/swagger`)
- SPA: http://localhost:5173 — `client/` (Vite proxies `/api` + `/swagger`)
- SQLite file: `src/api/data/admin.db` (created + seeded on first start)

Lane split: this branch owns the **API** (vault/RBAC/audit/auth/seed) and the **Admin chrome + login**. Home / Clients / Flags screens are stubs in `client/src/screens/` for Dev2. Types live in `client/src/contracts.ts`.

### Seed logins (exact AC)

| Name | Email | Role | Manager |
|------|-------|------|---------|
| Brandon Kay | brandon@bisconsultants.example | **admin** | — |
| Maya Chen | maya@bisconsultants.example | **staff** | Brandon |
| Chris Patel | chris@bisconsultants.example | staff | Brandon |
| Sam Ortiz | sam@bisconsultants.example | staff | Brandon |

Password for all seed users: **`Admin!2026`**

Work phone `(940) 555-0100` + ext (101 / 204 / 118 / 205). Maya’s birthday is forced in-window for demo.

Clients: Murray Media (Denton, complete), Northstar Dental, Oak + Iron Realty (Collin), Pecan Street Cafe, Harbor Kids Academy (prospect).

Murray Media: Bre primary/pinned · Scott + Jordan IT · Ronnie + Ana Digital · two addresses · Managed IT + M365 on · warning + care flags · vault by department.

### QA smoke

1. Login Brandon → Home week board (America/Chicago).
2. Open Murray Media → business Call/Email/Map/Website (not “Call Bre”) · vault Reveal · flags visible.
3. Clock in **Road** + destination → punch on Time.
4. Add a flag · give a kudos star · Mentions if `@` used.
5. Login Maya → Export / Admin / Reports / Audit **blocked** · own Time OK.
6. `/health` reachable.

SSO is **built but off** (`SSO_ENABLED=false`). Idle **15 minutes** signs out (and clocks out).

## RBAC (`staff` | `admin`) — server-enforced

Staff can use the client file, vault reveal/copy, flags, team, own time, #Post It, kudos, mentions, print (no secrets).  
Admin also gets Reports, Audit, Users/catalog/tokens/settings, and Export.

Access tokens (`adm_ext_…`) are read-only: no vault secrets, no admin routes.

## Vault

AES-256-GCM via `VAULT_DEK` (32-byte key, base64 or hex). Store iv + ciphertext.  
Never plaintext in logs, list/API payloads, print, export, or audit body.

## Azure (when credentials exist)

Locked names:

| | |
|---|---|
| Resource group | `rg-bis-admin-dashboard` |
| Region | `southcentralus` |
| API | `app-bis-admin-dashboard-api` |
| SPA | `app-bis-admin-dashboard` |
| Blob container | `files` |

HTTPS only. No FTP. SQL is **Entra-only** (no SQL username/password in Bicep).

### Key Vault → App Service env (locked)

CoS secret names are dash-safe. The app still reads `AUTH_SECRET` / `VAULT_DEK` / `BLOB_CONTAINER` / `SSO_ENABLED` / `ConnectionStrings:Default` (plus `StorageConnectionString` for blob).

| Key Vault secret | App Service setting | App reads |
|---|---|---|
| `SqlConnectionString` | `ConnectionStrings__Default` | `ConnectionStrings:Default` |
| `StorageConnectionString` | `StorageConnectionString` | `StorageConnectionString` |
| `BLOB-CONTAINER` | `BLOB_CONTAINER` | `BLOB_CONTAINER` (`files`) |
| `SSO-ENABLED` | `SSO_ENABLED` | `SSO_ENABLED` (`false`) |
| `AUTH-SECRET` | `AUTH_SECRET` | `AUTH_SECRET` |
| `VAULT-DEK` | `VAULT_DEK` | `VAULT_DEK` (32-byte) |

`APP_BASE_URL` / CORS stay as a regular App Service setting (not a KV secret).

```bash
az login
az account set --subscription <same BIS sub as GIS>
./scripts/deploy-azure.sh
```

If `az` is missing, the repo still builds and seeds locally. IaC lives in `infra/main.bicep`.

After Azure deploy: `./scripts/deploy-azure.sh` creates `SqlConnectionString`, `StorageConnectionString`, `BLOB-CONTAINER=files`, `SSO-ENABLED=false`, and (if missing) `AUTH-SECRET` + 32-byte `VAULT-DEK`. Grant the API identity SQL + blob + KV Secrets User, then hit the API once to migrate + seed. Do not rotate `VAULT-DEK` after vault rows exist.

## Repo layout

```
src/api     ASP.NET Core Web API + EF Core
client      React + Vite SPA (login + Admin chrome; Home/Clients/Flags are Dev2 stubs)
infra/      Bicep (RG, SQL, storage/files, KV, App Services, Insights)
scripts/    local + Azure deploy
tests/      QA smoke (Brandon/Maya/vault/export/token)
```

`dotnet test` and `npm run build` (in `client`) are the CI gates.

OpenAPI: http://localhost:5080/swagger · Dev2 contracts: `client/src/contracts.ts` + `client/README.md`.
