# Azure Provisioning Key Vault library for JavaScript

`@azure/provisioning-key-vault` provides Azure Key Vault resource classes for use with the [`@azure/provisioning`](../azure-provisioning) library. Use it to generate Bicep templates for Azure Key Vaults and Key Vault Secrets.

## Getting started

### Installation

```bash
npm install @azure/provisioning-key-vault @azure/provisioning
```

## Example

```typescript
import { Infrastructure, ProvisioningOutput, ProvisioningParameter } from '@azure/provisioning';
import { KeyVaultService, KeyVaultSecret } from '@azure/provisioning-key-vault';

const infra = Infrastructure.withDefaultLocation();
const location = infra.locationRef!;

const vault = new KeyVaultService('vault', { location });
infra.add(vault);

infra.add(new ProvisioningOutput('vaultUri', 'string', vault.vaultUri));
infra.add(new ProvisioningOutput('vaultName', 'string', vault.name));

const bicep = infra.build().compile();
```

## Resources

| Class | ARM type |
|---|---|
| `KeyVaultService` | `Microsoft.KeyVault/vaults@2024-11-01` |
| `KeyVaultSecret` | `Microsoft.KeyVault/vaults/secrets@2024-11-01` |

## Contributing

See the [contributing guide](https://github.com/Azure/azure-sdk-for-js/blob/main/CONTRIBUTING.md) for details.
