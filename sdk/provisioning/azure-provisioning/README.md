# Azure Provisioning library for JavaScript

`@azure/provisioning` is a TypeScript library for generating [Bicep](https://learn.microsoft.com/azure/azure-resource-manager/bicep/overview) infrastructure templates programmatically. It mirrors the functionality of the [Azure.Provisioning](https://www.nuget.org/packages/Azure.Provisioning) .NET library, enabling you to define Azure infrastructure as typed TypeScript code.

## Getting started

### Installation

```bash
npm install @azure/provisioning
```

### Prerequisites

- [Node.js](https://nodejs.org) version 20 or higher

## Key concepts

### `Infrastructure`

The root container that holds parameters, resources, and outputs. Call `build().compile()` to generate a Bicep template string.

```typescript
import { Infrastructure, ProvisioningParameter } from '@azure/provisioning';
import { resourceGroup } from '@azure/provisioning';

const infra = Infrastructure.withDefaultLocation();
const bicep = infra.build().compile();
```

### `ProvisioningParameter`

Represents a Bicep `param` declaration.

```typescript
const location = new ProvisioningParameter('location', {
  description: 'The location for the resource(s) to be deployed.',
  defaultValue: resourceGroup().location,
});
```

### `ProvisioningOutput`

Represents a Bicep `output` declaration.

```typescript
const output = new ProvisioningOutput('blobEndpoint', 'string', storage.blobEndpoint);
```

### `ProvisionableResource`

Abstract base class for all Azure resource types. Subclasses define their ARM type, API version, and body properties.

### Bicep functions

The `@azure/provisioning` package exports common Bicep functions:

```typescript
import { resourceGroup, uniqueString, take, tenant, bicepString } from '@azure/provisioning';

const name = take(bicepString`storage${uniqueString(resourceGroup().id)}`, 24);
```

## Example

```typescript
import { Infrastructure, ProvisioningOutput } from '@azure/provisioning';
import { StorageAccount, BlobService } from '@azure/provisioning-storage';

const infra = Infrastructure.withDefaultLocation();
const location = infra.locationRef!;

const storage = new StorageAccount('storage', {
  location,
  skuName: 'Standard_GRS',
});
infra.add(storage);

const blobs = new BlobService('blobs', storage);
infra.add(blobs);

infra.add(new ProvisioningOutput('blobEndpoint', 'string', storage.blobEndpoint));

const bicep = infra.build().compile();
console.log(bicep);
```

Outputs a Bicep template like:

```bicep
@description('The location for the resource(s) to be deployed.')
param location string = resourceGroup().location

resource storage 'Microsoft.Storage/storageAccounts@2024-01-01' = {
  name: take('storage${uniqueString(resourceGroup().id)}', 24)
  kind: 'StorageV2'
  location: location
  sku: {
    name: 'Standard_GRS'
  }
  properties: {
    accessTier: 'Hot'
    allowSharedKeyAccess: false
    minimumTlsVersion: 'TLS1_2'
    networkAcls: {
      defaultAction: 'Allow'
    }
  }
  tags: {
    'aspire-resource-name': 'storage'
  }
}

resource blobs 'Microsoft.Storage/storageAccounts/blobServices@2024-01-01' = {
  name: 'default'
  parent: storage
}

output blobEndpoint string = storage.properties.primaryEndpoints.blob
```

## Related packages

- [`@azure/provisioning-storage`](../azure-provisioning-storage) — Azure Storage resources
- [`@azure/provisioning-key-vault`](../azure-provisioning-key-vault) — Azure Key Vault resources

## Contributing

See the [contributing guide](https://github.com/Azure/azure-sdk-for-js/blob/main/CONTRIBUTING.md) for details on how to contribute to this project.
