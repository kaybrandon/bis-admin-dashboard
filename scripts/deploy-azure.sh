#!/usr/bin/env bash
# Deploy Admin Dashboard to rg-bis-admin-dashboard (southcentralus).
# Requires: az login in the BIS/GIS subscription.
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

echo "Deploying Bicep"
az deployment group create \
  --resource-group "$RG" \
  --template-file "$ROOT/infra/main.bicep" \
  --parameters principalId="$PRINCIPAL_ID" principalName="$PRINCIPAL_NAME" principalType="$PRINCIPAL_TYPE" \
  --output table

echo "Build API + SPA"
export PATH="$HOME/.dotnet:$PATH"
dotnet publish "$ROOT/src/api/Bis.Admin.Api.csproj" -c Release -o "$ROOT/artifacts/api"
(cd "$ROOT/src/web" && npm ci && npm run build)
rm -rf "$ROOT/artifacts/api/wwwroot"
mkdir -p "$ROOT/artifacts/api/wwwroot"
cp -R "$ROOT/src/web/dist/." "$ROOT/artifacts/api/wwwroot/"

echo "Zip + deploy API"
(cd "$ROOT/artifacts/api" && zip -qr ../api.zip .)
az webapp deploy --resource-group "$RG" --name app-bis-admin-dashboard-api --src-path "$ROOT/artifacts/api.zip" --type zip

echo "Done. Set Key Vault secrets AUTH_SECRET and VAULT_DEK (32-byte), BLOB + SQL refs."
echo "SSO_ENABLED must stay false. Then: migrate + seed against Azure SQL."
echo "Smoke: login Brandon (admin), Maya (staff), export blocked as Maya."
