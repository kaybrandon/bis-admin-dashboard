# Admin Dashboard — Roles + Admin Shoutout MVP AC
**Ticket:** ADMIN-ROLES-SHOUTOUT-MVP · Brandon GO 2026-09-17 ~17:42 CT (**Admin only — NOT GIS**)
**SoT:** this file. Prior `GIS-ROLES-SHOUTOUT-AC.md` is **VOID**.
**Chrome:** cream page · dark sidebar · green accent — **never GIS teal**.
**Queue:** @BA/@UX stamp **now**. @Dev on `kaybrandon/bis-admin-dashboard` after current Admin merge stack / Brandon priority. Does **not** block GIS §13+§14. Need help MVP stays GIS.

## Musts

### Must 1 — Roles page (new)
| | |
|---|---|
| Where | Admin Settings / Users → **Roles** (page or tab) |
| Flag | **Dashboard administrator** per user (grant / revoke) |
| Who | Existing Dashboard admin / Global Admin only (bootstrap: current Global Admin) |
| Fail if | No admin flag · self-promote · not persisted · built in **GIS** by mistake |

### Must 2 — Shoutout (admins only)
| | |
|---|---|
| Who | Only **Dashboard administrator** sees **Shoutout** |
| Presets | **Good morning** · **High five** · **Congratulations** |
| Emoji | 😊 🙌 ⭐ 🎉 (and similar) |
| Custom | Optional short text (cap **80** chars) |
| Delivery | Soft **toast / banner** to all **currently logged-in Admin Dashboard** users · auto-dismiss **4–8s** · not focus-trapping |
| Fail if | Non-admins shout · blocks UI · email required · **GIS** broadcast · offline inbox as required path |

### Must 3 — Rate limit (not annoying)
| | |
|---|---|
| Per-admin | **1 shoutout / 5 minutes** |
| Site-wide | Optional cooldown (e.g. **1 / 2 minutes**) |
| Sound | **No** auto-sound v1 |
| Fail if | Unlimited spam · trapping modal |

## Out of scope (v1)
- GIS Dashboard (Need help stays GIS separately)
- Offline email / SMS / push
- GIF upload / Slack-clone
- Non-admin shoutouts

## UX notes
Admin chrome only. Dense Roles grant/revoke · compact Shoutout composer · fading corner/top toast.

## QA bar
Grant/revoke persists · staff cannot Shoutout · multi-session toast · rate limit · **Fail** if GIS chrome or GIS repo.

## Owners
@BA AC · @UX Admin chrome · @Dev Admin repo · @QA admin-only + rate limit · @CoS zip gate

---

## UX SoT stamp (2026-09-17 ~17:44 CT)
**PASS** · Admin chrome only

| Artifact | Path |
|----------|------|
| Stamp | `design-update/roles-shoutout-mvp-ux-stamp.md` |
| HTML | `design-update/sot-roles-shoutout-mvp.html` |
| PNG | `design-update/sot-roles-shoutout-mvp.png` (1920×1200) |

Roles dense grant/revoke · Shoutout Good morning / High five / Congratulations + 😊🙌⭐🎉 + 80-char · soft fading toast. **VOID GIS** roles-shoutout SoT.

## UX SoT PASS (2026-09-17 ~17:45 CT)
**Status:** UX PASS · Admin cream/dark/green only  
**Visual:** `design-update/sot-roles-shoutout-mvp.png` · html · stamp md  

Roles page + Shoutout composer/toast. GIS roles-shoutout remains VOID.

