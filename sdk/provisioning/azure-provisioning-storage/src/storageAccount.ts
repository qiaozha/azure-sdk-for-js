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
    ParentResourceReference,
} from '@azure/provisioning';

/** Storage account SKU names. */
export type StorageSkuName =
    | 'Standard_LRS'
    | 'Standard_GRS'
    | 'Standard_RAGRS'
    | 'Standard_ZRS'
    | 'Premium_LRS'
    | 'Premium_ZRS'
    | 'Standard_GZRS'
    | 'Standard_RAGZRS';

/** Storage account kinds. */
export type StorageKind = 'Storage' | 'StorageV2' | 'BlobStorage' | 'FileStorage' | 'BlockBlobStorage';

/** Options for creating a StorageAccount resource. */
export interface StorageAccountOptions {
    /** The SKU name. Defaults to 'Standard_LRS'. */
    skuName?: StorageSkuName;
    /** The account kind. Defaults to 'StorageV2'. */
    kind?: StorageKind;
    /** The access tier. Defaults to 'Hot'. */
    accessTier?: 'Hot' | 'Cool' | 'Archive';
    /** The location parameter reference. Defaults to `resourceGroup().location`. */
    location?: BicepExpression;
    /** Whether shared key access is allowed. Defaults to false. */
    allowSharedKeyAccess?: boolean;
    /** Minimum TLS version. Defaults to 'TLS1_2'. */
    minimumTlsVersion?: 'TLS1_0' | 'TLS1_1' | 'TLS1_2';
    /** The aspire resource name tag value. Defaults to the logical name. */
    aspireResourceName?: string;
}

/**
 * Represents an Azure Storage Account resource for Bicep generation.
 *
 * @example
 * const storage = new StorageAccount('storage', { skuName: 'Standard_LRS' });
 *
 * // Access outputs
 * infra.add(new ProvisioningOutput('blobEndpoint', 'string', storage.blobEndpoint));
 * infra.add(new ProvisioningOutput('name', 'string', storage.name));
 */
export class StorageAccount extends ProvisionableResource {
    readonly armType = 'Microsoft.Storage/storageAccounts';
    readonly apiVersion = '2024-01-01';

    private readonly _skuName: StorageSkuName;
    private readonly _kind: StorageKind;
    private readonly _accessTier: string;
    private readonly _location: BicepExpression;
    private readonly _allowSharedKeyAccess: boolean;
    private readonly _minimumTlsVersion: string;
    private readonly _aspireResourceName: string;

    /** The ARM resource name expression (e.g., `take('storage${uniqueString(...)}', 24)`). */
    readonly resourceName: BicepExpression;

    constructor(logicalName: string, options: StorageAccountOptions = {}) {
        super(logicalName);
        this._skuName = options.skuName ?? 'Standard_LRS';
        this._kind = options.kind ?? 'StorageV2';
        this._accessTier = options.accessTier ?? 'Hot';
        this._location = options.location ?? resourceGroup().location;
        this._allowSharedKeyAccess = options.allowSharedKeyAccess ?? false;
        this._minimumTlsVersion = options.minimumTlsVersion ?? 'TLS1_2';
        this._aspireResourceName = options.aspireResourceName ?? logicalName;

        // Build the default ARM name: take('${logicalName}${uniqueString(resourceGroup().id)}', 24)
        this.resourceName = take(
            bicepString`${this._namePrefix()}${uniqueString(resourceGroup().id)}`,
            24
        );
    }

    private _namePrefix(): BicepExpression {
        // Return a raw Bicep string literal that will be part of the interpolation
        // The bicepString tag expects BicepExpressions, so wrap the prefix as one
        return { toBicep: () => this.logicalName.replace(/[^a-zA-Z0-9-]/g, '') };
    }

    getBodyProperties(): ResourceBodyEntry[] {
        return [
            ['name', this.resourceName],
            ['kind', this._kind],
            ['location', this._location],
            ['sku', { name: this._skuName }],
            [
                'properties',
                {
                    accessTier: this._accessTier,
                    allowSharedKeyAccess: this._allowSharedKeyAccess,
                    minimumTlsVersion: this._minimumTlsVersion,
                    networkAcls: { defaultAction: 'Allow' },
                },
            ],
            ['tags', { [`aspire-resource-name`]: this._aspireResourceName }],
        ];
    }

    /** Reference to the blob endpoint output: `storage.properties.primaryEndpoints.blob` */
    get blobEndpoint(): BicepExpression {
        return this.property('properties.primaryEndpoints.blob');
    }

    /** Reference to the queue endpoint output: `storage.properties.primaryEndpoints.queue` */
    get queueEndpoint(): BicepExpression {
        return this.property('properties.primaryEndpoints.queue');
    }

    /** Reference to the table endpoint output: `storage.properties.primaryEndpoints.table` */
    get tableEndpoint(): BicepExpression {
        return this.property('properties.primaryEndpoints.table');
    }

    /** Reference to the file endpoint output: `storage.properties.primaryEndpoints.file` */
    get fileEndpoint(): BicepExpression {
        return this.property('properties.primaryEndpoints.file');
    }

    /** Reference to the storage account name: `storage.name` */
    get name(): BicepExpression {
        return this.property('name');
    }

    /** Reference to the storage account id: `storage.id` */
    get id(): BicepExpression {
        return this.property('id');
    }
}

/**
 * Represents an Azure Blob Service resource (child of StorageAccount).
 *
 * @example
 * const blobs = new BlobService('blobs', storage);
 */
export class BlobService extends ProvisionableResource {
    readonly armType = 'Microsoft.Storage/storageAccounts/blobServices';
    readonly apiVersion = '2024-01-01';

    private readonly _parent: ParentResourceReference;

    constructor(logicalName: string, parent: StorageAccount) {
        super(logicalName);
        this._parent = parent.asParent();
    }

    getBodyProperties(): ResourceBodyEntry[] {
        return [
            ['name', 'default'],
            ['parent', this._parent],
        ];
    }
}

/**
 * Represents an Azure Blob Container resource (child of BlobService).
 *
 * @example
 * const container = new BlobContainer('mycontainer', blobs);
 */
export class BlobContainer extends ProvisionableResource {
    readonly armType = 'Microsoft.Storage/storageAccounts/blobServices/containers';
    readonly apiVersion = '2024-01-01';

    private readonly _containerName: BicepValue<string>;
    private readonly _parent: ParentResourceReference;

    constructor(logicalName: string, parent: BlobService, containerName?: BicepValue<string>) {
        super(logicalName);
        this._containerName = containerName ?? logicalName;
        this._parent = parent.asParent();
    }

    getBodyProperties(): ResourceBodyEntry[] {
        return [
            ['name', this._containerName],
            ['parent', this._parent],
        ];
    }
}

/**
 * Represents an Azure Queue Service resource (child of StorageAccount).
 */
export class QueueService extends ProvisionableResource {
    readonly armType = 'Microsoft.Storage/storageAccounts/queueServices';
    readonly apiVersion = '2024-01-01';

    private readonly _parent: ParentResourceReference;

    constructor(logicalName: string, parent: StorageAccount) {
        super(logicalName);
        this._parent = parent.asParent();
    }

    getBodyProperties(): ResourceBodyEntry[] {
        return [
            ['name', 'default'],
            ['parent', this._parent],
        ];
    }
}

/**
 * Represents an Azure Table Service resource (child of StorageAccount).
 */
export class TableService extends ProvisionableResource {
    readonly armType = 'Microsoft.Storage/storageAccounts/tableServices';
    readonly apiVersion = '2024-01-01';

    private readonly _parent: ParentResourceReference;

    constructor(logicalName: string, parent: StorageAccount) {
        super(logicalName);
        this._parent = parent.asParent();
    }

    getBodyProperties(): ResourceBodyEntry[] {
        return [
            ['name', 'default'],
            ['parent', this._parent],
        ];
    }
}
