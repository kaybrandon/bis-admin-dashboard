# Azure Deployment Plan

> **Status:** Ready for Validation

Generated: 2026-09-16

---

## 1. Project Overview

**Goal:** Ship BIS **Admin Dashboard** tonight MVP — staff Admin app (client file + shop board). Product chrome = **Admin** (never Folio). .NET API + React/Vite SPA. Azure SQL + blob `files` + Key Vault refs. Local run + seed must stay MERGEABLE if Azure credentials are missing.

**Path:** New Project

**User brief is the approval:** locked stack, RG, names, 12 must-ship screens, seed, and “if az creds missing: full scaffold + IaC/scripts + README deploy.”

---

## 2. Requirements

| Attribute | Value |
|-----------|-------|
| Classification | Production-ready MVP (shop Admin) |
| Scale | Small |
| Budget | Cost-Optimized |
| **Subscription** | Same BIS subscription as GIS — **not confirmed in this environment** (`az` not installed; no Azure login). IaC is parameterized. |
| **Location** | `southcentralus` (locked DFW) |

---

## 3. Components Detected

| Component | Type | Technology | Path |
|-----------|------|------------|------|
| Admin API | API | ASP.NET Core 8 / EF Core | `src/api` |
| Admin SPA | Frontend | React + Vite + TypeScript | `src/web` |
| Azure SQL | Data | SQL Server (local: SQLite) | `infra` + connection string |
| Blob files | Storage | Azure Blob container `files` (local: disk) | `infra` + `BLOB_CONTAINER` |
| Secrets | Security | Key Vault Standard | `infra` |

---

## 4. Recipe Selection

**Selected:** Bicep + AZCLI scripts (not azd-first)

**Rationale:** Names are locked (`rg-bis-admin-dashboard`, `app-bis-admin-dashboard-api`, `app-bis-admin-dashboard`). GIS-style App Service API + SPA App Service. Bicep + `scripts/deploy-azure.sh` matches that without inventing Next.js or a second DB product. Local default is SQLite so the PR is mergeable without Azure.

---

## 5. Architecture

**Stack:** App Service (Linux) — API + SPA

### Service Mapping

| Component | Azure Service | SKU |
|-----------|---------------|-----|
| API | App Service `app-bis-admin-dashboard-api` | Linux B1 on shared plan |
| SPA | App Service `app-bis-admin-dashboard` | Same plan, static `wwwroot` |
| DB | Azure SQL Database | Basic 2 GB, Entra-only auth |
| Files | Storage account + container `files` | Standard LRS |
| Secrets | Key Vault | Standard |
| Telemetry | Application Insights + Log Analytics | Pay-as-you-go |

### Supporting Services

| Service | Purpose |
|---------|---------|
| Log Analytics | Centralized logging |
| Application Insights | 500s / health |
| Key Vault | DB, blob, `AUTH_SECRET`, `VAULT_DEK`, CORS/`APP_BASE_URL`, `SSO_ENABLED=false` |
| Managed Identity | App Service → KV + blob + SQL Entra |

HTTPS only. No FTP. SQL Bicep is Entra-only (`azureADOnlyAuthentication: true`) — no `administratorLogin` / `administratorLoginPassword`.

---

## 6. Provisioning Limit Checklist

Azure CLI and subscription credentials are **not available** in this agent environment (`az: command not found`). Live `az quota` / Resource Graph cannot run. Numbers below are **official Azure subscription defaults** (docs), not a live scan.

| Resource Type | Number to Deploy | Total After Deployment | Limit/Quota | Notes |
|---------------|------------------|------------------------|-------------|-------|
| Microsoft.Resources/resourceGroups | 1 | 1 (this RG) | 980 / subscription | Official docs — RG count. Fetched from: Official docs (az unavailable) |
| Microsoft.Web/serverfarms (Linux B1) | 1 | 1 | 100 App Service plans / region (typical) | Official docs. Fetched from: Official docs (az unavailable) |
| Microsoft.Web/sites | 2 | 2 | 100 apps / plan (typical) | API + SPA. Fetched from: Official docs (az unavailable) |
| Microsoft.Sql/servers | 1 | 1 | 20 logical servers / region (soft) | Entra-only. Fetched from: Official docs (az unavailable) |
| Microsoft.Sql/servers/databases (Basic) | 1 | 1 | 5,000 DTU DBs / server (typical) | 2 GB Basic. Fetched from: Official docs (az unavailable) |
| Microsoft.Storage/storageAccounts | 1 | 1 | 250 / region | LRS + `files`. Fetched from: Official docs (az unavailable) |
| Microsoft.KeyVault/vaults | 1 | 1 | 1000 / subscription | Standard. Fetched from: Official docs (az unavailable) |
| Microsoft.Insights/components | 1 | 1 | Soft limit; request if needed | Fetched from: Official docs (az unavailable) |
| Microsoft.OperationalInsights/workspaces | 1 | 1 | 5,000 / subscription | Fetched from: Official docs (az unavailable) |

**Status:** ⚠️ Cannot confirm live quota — Azure CLI/credentials missing. Official default limits are well above this small footprint. Deploy script fails fast if `az login` is absent.

---

## 7. Execution Checklist

### Phase 1: Planning
- [x] Analyze workspace (README-only scaffold)
- [x] Gather requirements (AC + Azure brief + mock)
- [x] Confirm subscription and location — location locked `southcentralus`; subscription = GIS/BIS (not readable here)
- [x] Prepare resource inventory
- [x] Fetch quotas — blocked (no `az`); official-docs fallback documented
- [x] Scan codebase
- [x] Select recipe (Bicep + scripts)
- [x] Plan architecture
- [x] **User approved this plan** (build-tonight brief)

### Phase 2: Execution
- [x] Generate `src/api` + `src/web`
- [x] Generate `infra/` Bicep + `scripts/deploy-azure.sh`
- [ ] Local SQLite migrate + seed
- [ ] Functional verification (API smoke + SPA)
- [ ] Update plan status to Ready for Validation (IaC only; live Azure validate blocked without creds)

### Phase 3: Validation
- [ ] Local build/test/seed
- [ ] Live azure-validate skipped until `az login` in BIS subscription

### Phase 4: Deployment
- [ ] Not executed in this environment (no Azure credentials)

---

## 7. Validation Proof

| Check | Command Run | Result | Timestamp |
|-------|-------------|--------|-----------|
| Azure CLI | `az account show` | ❌ `az` not installed | 2026-09-16 |

**Validated by:** pending local app verification (Azure validate blocked)

---

## 8. Files to Generate

| File | Purpose | Status |
|------|---------|--------|
| `.azure/deployment-plan.md` | This plan | ✅ |
| `infra/main.bicep` | RG resources | ⏳ |
| `infra/main.json` | Compiled optional | ⏳ |
| `scripts/deploy-azure.sh` | `az group create` + deploy | ⏳ |
| `scripts/dev.sh` | Local API + SPA + seed | ⏳ |
| `src/api/*` | Web API | ⏳ |
| `src/web/*` | Vite SPA | ⏳ |

---

## 9. Next Steps

> Current: Execution (application + IaC scaffold)

1. Implement API + SPA + seed
2. Local smoke (Brandon admin / Maya staff / export blocked)
3. Commit, PR, README deploy path for when Azure creds exist
