# Admin Dashboard — Roles + Admin Shoutout MVP · UX stamp

**Ticket:** ADMIN-ROLES-SHOUTOUT-MVP · Musts from `ADMIN-ROLES-SHOUTOUT-AC.md`  
**Product:** **Admin Dashboard** (`kaybrandon/bis-admin-dashboard`) · Dashboard administrator flag + soft company shoutout  
**Stamp:** 2026-09-17 ~17:42 CT · @UX  
**Visual SoT:** `design-update/sot-roles-shoutout-mvp.html` · `design-update/sot-roles-shoutout-mvp.png`  
**Chrome:** cream `#F7F4EE` · dark sidebar `#1C1F24` · green accent `#2F6B4F` — **never GIS teal**  
**VOID:** GIS `gis-dashboard/mockups/roles-shoutout-mvp-ux-stamp.md` (+ any GIS roles-shoutout SoT) → use Admin `design-update/sot-roles-shoutout-mvp.html` / `.png` / this stamp.  
**Queue:** @Dev on Admin repo after current Admin merge stack / Brandon priority. Need help MVP stays GIS.

---

## 1. Roles page stamp

**Nav:** Settings → **Users** → **Roles** (or Admin / Settings path → Roles). Sidebar: Home · Clients · Flags · Team · Time · #Post It · **Admin** · **Settings**.  
**Who can change:** **Global Admin only** — grant/revoke Dashboard administrator. Non–Global Admin sees read-only or no control.

### Dense user table

| Column | Spec |
|--------|------|
| **Name** | Full display name |
| **Email** | Work email |
| **Dashboard administrator** | Grant / Revoke toggle or button |
| **Admin chip** | Clear **Admin** chip when Dashboard administrator is On |

### States

| State | Control | Chip |
|-------|---------|------|
| Granted | **Revoke** (or toggle On) | **Admin** chip visible |
| Not granted | **Grant** (or toggle Off) | No chip |
| Permission | Only Global Admin interactive | Fail if staff can flip |

**Mock:** 1–2 admins already granted · one **Revoke** control shown · remaining users **Grant**.

---

## 2. Shoutout composer stamp (admins only)

**Entry:** Header control **Shoutout** — visible only when signed-in user is Dashboard administrator (or Global Admin).

### Presets (exact chips)

| Chip |
|------|
| **Good morning** |
| **High five** |
| **Congratulations** |

### Emoji row

😊 · 🙌 · ⭐ · 🎉

### Optional short text

- Max **80 characters**
- Live **counter** (`n / 80`)
- Optional — Send allowed with preset and/or emoji alone

### Send

Primary **Send** button. On success → soft toast (panel C); composer closes or resets.

### Rate limit (Must — note in product)

- **1 shoutout / admin / 5 minutes**
- Optional muted disabled state: **Wait 4:12** (countdown) on Send when cooling down
- No sound in v1

---

## 3. Soft toast stamp

| Rule | Spec |
|------|------|
| Placement | Top center or corner |
| Behavior | Fading · auto-dismiss **4–8s** |
| Interaction | **Not** modal · **not** focus-trapping |
| Audience | Logged-in **Admin Dashboard** users (mock: toast visible on canvas) |
| Sound | **None** |
| Content | Preset + emoji + optional text · attribution (e.g. from Brandon) |

**Example copy:** `High five 🙌 — Nice week so far` · from Brandon

---

## Mock canvas (3 panels)

Single **1920×1200** SoT — Admin cream/dark/green chrome, dense:

| Panel | Shows |
|-------|-------|
| **A — Roles page** | Sidebar Settings/Admin path · **Roles** active · dense user table · 1–2 admins with **Admin** chip · one **Revoke** |
| **B — Shoutout composer** | Open from header **Shoutout** · presets Good morning / High five / Congratulations · emoji row · 80-char field + counter · Send · optional muted **Wait 4:12** note |
| **C — Soft toast** | Fading toast: **High five 🙌 — Nice week so far** from Brandon |

---

## AC map

| Must | Stamp coverage |
|------|----------------|
| 1 Roles page | Settings/Users → Roles · Name · Email · Dashboard administrator grant/revoke · Admin chip · Global Admin only |
| 2 Shoutout composer | Admins only · presets + emoji + 80-char + Send |
| 3 Soft toast | Top/corner · fading 4–8s · not modal · no sound |
| Rate limit | Stamp note 1 / 5 min · optional Wait 4:12 disabled |

## Out of scope (v1) — do not mock as live

GIS Dashboard · Need help (GIS) · Offline email / SMS / push · rich GIF upload · Slack-clone · non-admin shoutouts · sound · blocking modal

## Owners

@UX this stamp · @BA `ADMIN-ROLES-SHOUTOUT-AC.md` · @Dev Admin Global Admin + toast fan-out · @QA grant/revoke + multi-session toast + rate limit · @CoS zip gate
