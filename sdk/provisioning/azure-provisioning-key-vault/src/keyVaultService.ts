// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {
    ProvisionableResource,
    ResourceBodyEntry,
    BicepExpression,
    BicepValue,
    bicepString,
    uniqueString,
    take,
    resourceGroup,
    tenant,
    ParentResourceReference,
} from '@azure/provisioning';

/** Key Vault SKU family. */
export type KeyVaultSkuFamily = 'A';

/** Key Vault SKU name. */
export type KeyVaultSkuName = 'standard' | 'premium';

/** Options for creating a KeyVaultService resource. */
export interface KeyVaultServiceOptions {
    /** The SKU family. Defaults to 'A'. */
    skuFamily?: KeyVaultSkuFamily;
    /** The SKU name. Defaults to 'standard'. */
    skuName?: KeyVaultSkuName;
    /** Enable RBAC authorization. Defaults to true. */
    enableRbacAuthorization?: boolean;
    /** Enable soft delete. Defaults to undefined (uses ARM default). */
    enableSoftDelete?: boolean;
    /** The location parameter reference. Defaults to `resourceGroup().location`. */
    location?: BicepExpression;
    /** The aspire resource name tag value. Defaults to the logical name. */
    aspireResourceName?: string;
}

/**
 * Represents an Azure Key Vault resource for Bicep generation.
 *
 * @example
 * const vault = new KeyVaultService('vault');
 * infra.add(vault);
 * infra.add(new ProvisioningOutput('vaultUri', 'string', vault.vaultUri));
 */
export class KeyVaultService extends ProvisionableResource {
    readonly armType = 'Microsoft.KeyVault/vaults';
    readonly apiVersion = '2024-11-01';

    private readonly _skuFamily: KeyVaultSkuFamily;
    private readonly _skuName: KeyVaultSkuName;
    private readonly _enableRbacAuthorization: boolean;
    private readonly _enableSoftDelete: boolean | undefined;
    private readonly _location: BicepExpression;
    private readonly _aspireResourceName: string;

    /** The ARM resource name expression (e.g., `take('vault${uniqueString(...)}', 24)`). */
    readonly resourceName: BicepExpression;

    constructor(logicalName: string, options: KeyVaultServiceOptions = {}) {
        super(logicalName);
        this._skuFamily = options.skuFamily ?? 'A';
        this._skuName = options.skuName ?? 'standard';
        this._enableRbacAuthorization = options.enableRbacAuthorization ?? true;
        this._enableSoftDelete = options.enableSoftDelete;
        this._location = options.location ?? resourceGroup().location;
        this._aspireResourceName = options.aspireResourceName ?? logicalName;

        // Build: take('vault${uniqueString(resourceGroup().id)}', 24)
        const prefix = logicalName.replace(/[^a-zA-Z0-9-]/g, '');
        this.resourceName = take(
            bicepString`${({ toBicep: () => prefix } as BicepExpression)}${uniqueString(resourceGroup().id)}`,
            24
        );
    }

    getBodyProperties(): ResourceBodyEntry[] {
        const properties: Record<string, unknown> = {
            tenantId: tenant().tenantId,
            sku: {
                family: this._skuFamily,
                name: this._skuName,
            },
            enableRbacAuthorization: this._enableRbacAuthorization,
        };

        if (this._enableSoftDelete !== undefined) {
            properties['enableSoftDelete'] = this._enableSoftDelete;
        }

        return [
            ['name', this.resourceName],
            ['location', this._location],
            ['properties', properties as ResourceBodyEntry[1]],
            ['tags', { [`aspire-resource-name`]: this._aspireResourceName }],
        ];
    }

    /** Reference to the vault URI: `vault.properties.vaultUri` */
    get vaultUri(): BicepExpression {
        return this.property('properties.vaultUri');
    }

    /** Reference to the vault name: `vault.name` */
    get name(): BicepExpression {
        return this.property('name');
    }

    /** Reference to the vault ID: `vault.id` */
    get id(): BicepExpression {
        return this.property('id');
    }
}

/** Options for creating a KeyVaultSecret resource. */
export interface KeyVaultSecretOptions {
    /** The secret value. */
    value: BicepValue<string>;
    /** Whether the secret is enabled. Defaults to true. */
    enabled?: boolean;
}

/**
 * Represents an Azure Key Vault secret resource.
 *
 * @example
 * const secret = new KeyVaultSecret('mySecret', vault, { value: param.reference });
 */
export class KeyVaultSecret extends ProvisionableResource {
    readonly armType = 'Microsoft.KeyVault/vaults/secrets';
    readonly apiVersion = '2024-11-01';

    private readonly _parent: ParentResourceReference;
    private readonly _value: BicepValue<string>;
    private readonly _enabled: boolean;
    private readonly _secretName: BicepValue<string>;

    constructor(
        logicalName: string,
        parent: KeyVaultService,
        secretName: BicepValue<string>,
        options: KeyVaultSecretOptions
    ) {
        super(logicalName);
        this._parent = parent.asParent();
        this._secretName = secretName;
        this._value = options.value;
        this._enabled = options.enabled ?? true;
    }

    getBodyProperties(): ResourceBodyEntry[] {
        return [
            ['name', this._secretName],
            ['parent', this._parent],
            [
                'properties',
                {
                    value: this._value,
                    attributes: {
                        enabled: this._enabled,
                    },
                },
            ],
        ];
    }
}
