targetScope = 'resourceGroup'

@description('Azure region. Locked DFW unless Brandon overrides.')
param location string = 'southcentralus'

@description('Entra admin object id for Azure SQL (user, group, or app).')
param principalId string

@description('Entra admin display name / login for Azure SQL.')
param principalName string

@allowed(['User', 'Group', 'Application'])
param principalType string = 'User'

@description('SPA public origin used for CORS and APP_BASE_URL.')
param spaBaseUrl string = 'https://app-bis-admin-dashboard.azurewebsites.net'

var uniqueHash = uniqueString(resourceGroup().id)
var sqlName = 'sql-bis-admin-dashboard-${uniqueHash}'
var kvName = take('kv-bis-admin-${uniqueHash}', 24)
var stName = take('stbisadmin${uniqueHash}', 24)
var planName = 'plan-bis-admin-dashboard'
var apiName = 'app-bis-admin-dashboard-api'
var spaName = 'app-bis-admin-dashboard'
var insightsName = 'appi-bis-admin-dashboard'
var lawName = 'law-bis-admin-dashboard'

resource law 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: lawName
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource insights 'Microsoft.Insights/components@2020-02-02' = {
  name: insightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: law.id
  }
}

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: kvName
  location: location
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
  }
}

resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: stName
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: storage
  name: 'default'
}

resource files 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'files'
}

resource sql 'Microsoft.Sql/servers@2022-05-01-preview' = {
  name: sqlName
  location: location
  properties: {
    administrators: {
      administratorType: 'ActiveDirectory'
      principalType: principalType
      login: principalName
      sid: principalId
      tenantId: subscription().tenantId
      azureADOnlyAuthentication: true
    }
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
  }
}

resource db 'Microsoft.Sql/servers/databases@2022-05-01-preview' = {
  parent: sql
  name: 'admin'
  location: location
  sku: { name: 'Basic', tier: 'Basic' }
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
    maxSizeBytes: 2147483648
  }
}

resource sqlFw 'Microsoft.Sql/servers/firewallRules@2022-05-01-preview' = {
  parent: sql
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource plan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: planName
  location: location
  sku: { name: 'B1', tier: 'Basic' }
  kind: 'linux'
  properties: { reserved: true }
}

resource apiIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-bis-admin-dashboard'
  location: location
}

var sqlConn = 'Server=tcp:${sql.properties.fullyQualifiedDomainName},1433;Database=${db.name};Authentication=Active Directory Managed Identity;User Id=${apiIdentity.properties.clientId};Encrypt=True;TrustServerCertificate=False;'
var storageConn = 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=core.windows.net'

// CoS locked Key Vault secret names (dash-safe). App reads the mapped env names.
// KV secret                  → App Service env
// SqlConnectionString        → ConnectionStrings__Default
// StorageConnectionString    → StorageConnectionString
// BLOB-CONTAINER             → BLOB_CONTAINER
// SSO-ENABLED                → SSO_ENABLED
// AUTH-SECRET                → AUTH_SECRET
// VAULT-DEK                  → VAULT_DEK
resource kvSql 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: kv
  name: 'SqlConnectionString'
  properties: { value: sqlConn }
}

resource kvStorage 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: kv
  name: 'StorageConnectionString'
  properties: { value: storageConn }
}

resource kvBlobContainer 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: kv
  name: 'BLOB-CONTAINER'
  properties: { value: 'files' }
}

resource kvSso 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: kv
  name: 'SSO-ENABLED'
  properties: { value: 'false' }
}

var kvSecretsUserRole = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')

resource apiKvSecrets 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, apiIdentity.id, kvSecretsUserRole)
  scope: kv
  properties: {
    roleDefinitionId: kvSecretsUserRole
    principalId: apiIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

var kvSecretsOfficerRole = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7')

resource deployerKvSecrets 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, principalId, kvSecretsOfficerRole)
  scope: kv
  properties: {
    roleDefinitionId: kvSecretsOfficerRole
    principalId: principalId
    principalType: principalType == 'Application' ? 'ServicePrincipal' : principalType
  }
}

var kvRef = {
  sql: '@Microsoft.KeyVault(SecretUri=${kv.properties.vaultUri}secrets/SqlConnectionString)'
  storage: '@Microsoft.KeyVault(SecretUri=${kv.properties.vaultUri}secrets/StorageConnectionString)'
  blob: '@Microsoft.KeyVault(SecretUri=${kv.properties.vaultUri}secrets/BLOB-CONTAINER)'
  sso: '@Microsoft.KeyVault(SecretUri=${kv.properties.vaultUri}secrets/SSO-ENABLED)'
  auth: '@Microsoft.KeyVault(SecretUri=${kv.properties.vaultUri}secrets/AUTH-SECRET)'
  vault: '@Microsoft.KeyVault(SecretUri=${kv.properties.vaultUri}secrets/VAULT-DEK)'
}

resource api 'Microsoft.Web/sites@2023-01-01' = {
  name: apiName
  location: location
  kind: 'app,linux'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${apiIdentity.id}': {}
    }
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    keyVaultReferenceIdentity: apiIdentity.id
    siteConfig: {
      linuxFxVersion: 'DOTNETCORE|10.0'
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      appSettings: [
        { name: 'APPINSIGHTS_INSTRUMENTATIONKEY', value: insights.properties.InstrumentationKey }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: insights.properties.ConnectionString }
        { name: 'APP_BASE_URL', value: spaBaseUrl }
        { name: 'AZURE_CLIENT_ID', value: apiIdentity.properties.clientId }
        { name: 'ConnectionStrings__Default', value: kvRef.sql }
        { name: 'StorageConnectionString', value: kvRef.storage }
        { name: 'BLOB_CONTAINER', value: kvRef.blob }
        { name: 'SSO_ENABLED', value: kvRef.sso }
        { name: 'AUTH_SECRET', value: kvRef.auth }
        { name: 'VAULT_DEK', value: kvRef.vault }
      ]
    }
  }
  dependsOn: [
    kvSql
    kvStorage
    kvBlobContainer
    kvSso
    apiKvSecrets
  ]
}

resource spa 'Microsoft.Web/sites@2023-01-01' = {
  name: spaName
  location: location
  kind: 'app,linux'
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      appSettings: [
        { name: 'APPINSIGHTS_INSTRUMENTATIONKEY', value: insights.properties.InstrumentationKey }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: insights.properties.ConnectionString }
        { name: 'SCM_DO_BUILD_DURING_DEPLOYMENT', value: 'false' }
      ]
    }
  }
}

output resourceGroupName string = resourceGroup().name
output apiName string = api.name
output spaName string = spa.name
output keyVaultName string = kv.name
output sqlServerName string = sql.name
output storageAccountName string = storage.name
output filesContainer string = 'files'
output nextSteps string = 'Set Key Vault secrets AUTH-SECRET and VAULT-DEK (32-byte). App env: AUTH_SECRET, VAULT_DEK, BLOB_CONTAINER, SSO_ENABLED, StorageConnectionString, ConnectionStrings__Default. SSO-ENABLED stays false.'
