# Home / Clients / Flags API (Dev2)

OpenAPI UI: `http://localhost:5080/swagger`  
Spec: `http://localhost:5080/swagger/v1/swagger.json`  
TypeScript: `client/src/contracts.ts`

Auth: `POST /api/auth/login` `{ email, password }` → `{ token, user }`.  
Header: `Authorization: Bearer <jwt>`. Idle JWT is 15 minutes; SPA refreshes.

SSO is built and **off** (`SSO_ENABLED=false`). `GET /api/auth/sso/start` → 403.

## Home

`GET /api/home` → `HomeBoardDto`

- `weekStart` / `weekEnd` (`yyyy-MM-dd`) / `weekLabel` (`Sep 14–20 · America/Chicago`) / `tz: "America/Chicago"` (Mon–Sun)
- `stats.wins | onRoad | inOffice | openFlags`
- `posts[]` (`kind` win|update, `comments[]`)
- `starOfDay` `{ to, body, from }` or null — `from` is a real user GUID (never empty)
- `mentions[]` `{ userId, name, count }`
- `kudosTop[]` `{ userId, name, initials, avatarColor, stars }` — **1 deed = 1 star**
- `birthdays[]` — yesterday/today/tomorrow; Maya is seeded in-window

## Clients

| | |
|---|---|
| List | `GET /api/clients?industry=&county=&status=&q=&service=` → `ClientListRowDto[]` (`service` = catalog name or id; on services only) |
| Create | `POST /api/clients` `ClientCreateRequest` → `{ id }` |
| File | `GET /api/clients/{id}` → `ClientFileDto` |
| Print | `GET /api/clients/{id}/print` — **no vault, no care flags** |
| People | `POST /api/clients/{id}/people` `PersonWriteRequest` |
| Addresses | `POST /api/clients/{id}/addresses` `AddressWriteRequest` |
| Notes | `POST /api/clients/{id}/notes` `{ body }` (`@Name` → mention) |
| Vault list | `GET /api/clients/{id}/vault` — `secret` is always `••••••••` |
| Vault add | `POST /api/clients/{id}/vault` `{ department, title, username?, secret, url?, note? }` |
| Reveal | `POST /api/clients/{id}/vault/{credId}/reveal` → `{ secret }` human staff only |
| Files | `POST /api/clients/{id}/files` multipart `file` (images compress) · download `GET /files/{id}` or `GET /api/files/{id}` (JWT) |
| Lookups | `GET /api/lookups` counties, flagLevels, services, departments |

`business.call` / `email` / `map` / `website` are **business** fields. Never “Call Bre”.

Murray Media id: `66666666-6666-6666-6666-666666666601`

## Flags

| | |
|---|---|
| List | `GET /api/flags?state=open\|archived&clientId=&levelId=` → `FlagRowDto[]` |
| Create | `POST /api/flags` `{ clientId, levelId, body, personId? }` |
| Archive | `POST /api/flags/{id}/archive` → `purgeAt` = now + 90 days |
| Restore | `POST /api/flags/{id}/restore` (only while hold remains) |

Archived flags hide on the client file. After 90 days they are purged and cannot be restored.

## RBAC (server)

Staff: clients, vault reveal, flags, team, own time, #Post It, kudos, mentions, print (no secrets).  
Admin only: reports, audit, users/catalog/tokens/settings, export.  
`adm_ext_` tokens: read-only, **no vault**, **no admin**.
