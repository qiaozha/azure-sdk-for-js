# Azure Provisioning Storage library for JavaScript

`@azure/provisioning-storage` provides Azure Storage resource classes for use with the [`@azure/provisioning`](../azure-provisioning) library. Use it to generate Bicep templates for Azure Storage Accounts, Blob Services, Blob Containers, Queue Services, and Table Services.

## Getting started

### Installation

```bash
npm install @azure/provisioning-storage @azure/provisioning
```

## Example

```typescript
import { Infrastructure, ProvisioningOutput } from '@azure/provisioning';
import { StorageAccount, BlobService, BlobContainer, QueueService, TableService } from '@azure/provisioning-storage';

const infra = Infrastructure.withDefaultLocation();
const location = infra.locationRef!;

const storage = new StorageAccount('storage', {
  location,
  skuName: 'Standard_GRS',
});
infra.add(storage);

const blobs = new BlobService('blobs', storage);
infra.add(blobs);

const container = new BlobContainer('mycontainer', blobs);
infra.add(container);

infra.add(new ProvisioningOutput('blobEndpoint', 'string', storage.blobEndpoint));
infra.add(new ProvisioningOutput('queueEndpoint', 'string', storage.queueEndpoint));

const bicep = infra.build().compile();
```

## Resources

| Class | ARM type |
|---|---|
| `StorageAccount` | `Microsoft.Storage/storageAccounts@2024-01-01` |
| `BlobService` | `Microsoft.Storage/storageAccounts/blobServices@2024-01-01` |
| `BlobContainer` | `Microsoft.Storage/storageAccounts/blobServices/containers@2024-01-01` |
| `QueueService` | `Microsoft.Storage/storageAccounts/queueServices@2024-01-01` |
| `TableService` | `Microsoft.Storage/storageAccounts/tableServices@2024-01-01` |

## Contributing

See the [contributing guide](https://github.com/Azure/azure-sdk-for-js/blob/main/CONTRIBUTING.md) for details.
