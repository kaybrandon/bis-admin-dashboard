# Admin SPA (`client/`)

React + Vite shell. Product chrome is **Admin** (never Folio). Cream page, sidebar `#1c332c`, accent `#1c7a5c`.

## Dev2 lane

Wire **Home**, **Clients** (list + client file + print), and **Flags** against the live API.

- Replace stubs in `src/screens/HomeBoard.tsx`, `Clients.tsx`, `Flags.tsx`.
- Types: `src/contracts.ts`
- OpenAPI: `http://localhost:5080/swagger` (also `/swagger/v1/swagger.json`)
- Auth: `src/api.ts` (`login` / `api()` already attach the JWT)
- Mock: `Admin_UI_Mock.html` in the handoff

Do **not** change API routes or vault/RBAC/audit behavior. Login + layout chrome stay in `src/App.tsx`.

### Must rules
- Call / Email / Map / Website = **business** fields, not a person (“Call Bre” is wrong).
- Vault list is `••••••••` until explicit Reveal. Never print/export/log plaintext.
- Flags: archive → 90-day hold → purge. Restore only while in hold.
- Week board: Mon–Sun `America/Chicago`. Kudos: 1 deed = 1 star.

### Seed
Murray Media id `66666666-6666-6666-6666-666666666601`. Brandon admin / Maya staff. Password `Admin!2026`.
