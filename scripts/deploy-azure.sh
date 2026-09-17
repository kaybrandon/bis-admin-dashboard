#!/usr/bin/env bash
# Deploy Admin Dashboard to rg-bis-admin-dashboard (southcentralus).
# Requires: az login in the BIS/GIS subscription.
#
# CoS locked Key Vault secret names (dash-safe) → App Service env:
#   SqlConnectionString     → ConnectionStrings__Default
#   StorageConnectionString → StorageConnectionString
#   BLOB-CONTAINER          → BLOB_CONTAINER
#   SSO-ENABLED             → SSO_ENABLED
#   AUTH-SECRET             → AUTH_SECRET
#   VAULT-DEK               → VAULT_DEK
# The API still reads AUTH_SECRET / VAULT_DEK / BLOB_CONTAINER / SSO_ENABLED /
# ConnectionStrings:Default / StorageConnectionString.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if ! command -v az >/dev/null 2>&1; then
  echo "Azure CLI is not installed. Local run still works: ./scripts/dev.sh"
  echo "Install az, then: az login && az account set --subscription <BIS/GIS sub>"
  exit 1
fi

if ! az account show >/dev/null 2>&1; then
  echo "Not logged in. Run: az login"
  exit 1
fi

RG="${RG:-rg-bis-admin-dashboard}"
LOC="${LOC:-southcentralus}"
PRINCIPAL_ID="${AZURE_PRINCIPAL_ID:-$(az ad signed-in-user show --query id -o tsv)}"
PRINCIPAL_NAME="${AZURE_PRINCIPAL_NAME:-$(az ad signed-in-user show --query displayName -o tsv)}"
PRINCIPAL_TYPE="${AZURE_PRINCIPAL_TYPE:-User}"

echo "Creating $RG in $LOC (no-op if it exists)"
az group create -n "$RG" -l "$LOC" --output none

echo "Deploying Bicep (KV secrets SqlConnectionString, StorageConnectionString, BLOB-CONTAINER, SSO-ENABLED)"
az deployment group create \
  --resource-group "$RG" \
  --template-file "$ROOT/infra/main.bicep" \
  --parameters principalId="$PRINCIPAL_ID" principalName="$PRINCIPAL_NAME" principalType="$PRINCIPAL_TYPE" \
  --output table

KV="$(az deployment group show -g "$RG" -n main --query properties.outputs.keyVaultName.value -o tsv 2>/dev/null || true)"
if [[ -z "${KV}" ]]; then
  KV="$(az keyvault list -g "$RG" --query "[0].name" -o tsv)"
fi

ensure_secret() {
  local name="$1"
  local value="$2"
  if az keyvault secret show --vault-name "$KV" --name "$name" --query id -o tsv >/dev/null 2>&1; then
    echo "KV secret $name already set — leaving it"
  else
    az keyvault secret set --vault-name "$KV" --name "$name" --value "$value" --output none
    echo "KV secret $name created"
  fi
}

echo "Ensuring AUTH-SECRET and VAULT-DEK (do not rotate VAULT-DEK after vault rows exist)"
# AUTH-SECRET: long random string. VAULT-DEK: 32 raw bytes, stored as base64.
ensure_secret "AUTH-SECRET" "${AUTH_SECRET:-$(openssl rand -base64 48)}"
ensure_secret "VAULT-DEK" "${VAULT_DEK:-$(openssl rand -base64 32)}"

echo "KV → App Service env (API app-bis-admin-dashboard-api):"
echo "  SqlConnectionString     → ConnectionStrings__Default"
echo "  StorageConnectionString → StorageConnectionString"
echo "  BLOB-CONTAINER          → BLOB_CONTAINER"
echo "  SSO-ENABLED             → SSO_ENABLED   (must stay false)"
echo "  AUTH-SECRET             → AUTH_SECRET"
echo "  VAULT-DEK               → VAULT_DEK"

echo "Build API + SPA"
export PATH="$HOME/.dotnet:$PATH"
dotnet publish "$ROOT/src/api/Bis.Admin.Api.csproj" -c Release -o "$ROOT/artifacts/api"
(cd "$ROOT/client" && npm ci && npm run build)
rm -rf "$ROOT/artifacts/api/wwwroot"
mkdir -p "$ROOT/artifacts/api/wwwroot"
cp -R "$ROOT/client/dist/." "$ROOT/artifacts/api/wwwroot/"

echo "Zip + deploy API"
(cd "$ROOT/artifacts/api" && zip -qr ../api.zip .)
az webapp deploy --resource-group "$RG" --name app-bis-admin-dashboard-api --src-path "$ROOT/artifacts/api.zip" --type zip
az webapp restart --resource-group "$RG" --name app-bis-admin-dashboard-api --output none

echo "Done. Hit the API once to migrate + seed against Azure SQL."
echo "Smoke: login Brandon (admin), Maya (staff), export blocked as Maya."
