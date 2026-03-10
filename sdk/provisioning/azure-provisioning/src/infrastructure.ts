// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ProvisioningParameter } from './parameter.js';
import { ProvisioningOutput } from './output.js';
import { ProvisionableResource } from './resource.js';
import { resourceGroup } from './functions.js';

/**
 * The compiled result of an Infrastructure definition.
 */
export class CompiledInfrastructure {
    constructor(
        private readonly parameters: ProvisioningParameter[],
        private readonly resources: ProvisionableResource[],
        private readonly outputs: ProvisioningOutput[]
    ) {}

    /**
     * Compiles all parameters, resources, and outputs into a Bicep template string.
     */
    compile(): string {
        const sections: string[] = [];

        // Parameters
        if (this.parameters.length > 0) {
            sections.push(this.parameters.map(p => p.toBicep()).join('\n\n'));
        }

        // Resources
        for (const resource of this.resources) {
            sections.push(resource.toBicep());
        }

        // Outputs
        if (this.outputs.length > 0) {
            sections.push(this.outputs.map(o => o.toBicep()).join('\n\n'));
        }

        return sections.join('\n\n') + '\n';
    }
}

/**
 * Container for Azure provisioning resources, parameters, and outputs.
 * Analogous to `Azure.Provisioning.Infrastructure` in the .NET library.
 *
 * @example
 * const infra = new Infrastructure();
 *
 * const location = new ProvisioningParameter('location', {
 *   description: 'The location for the resource(s) to be deployed.',
 *   defaultValue: resourceGroup().location,
 * });
 * infra.add(location);
 *
 * const storage = new StorageAccount('storage', { skuName: 'Standard_LRS' });
 * infra.add(storage);
 *
 * infra.add(new ProvisioningOutput('blobEndpoint', 'string', storage.blobEndpoint));
 *
 * const bicep = infra.build().compile();
 */
export class Infrastructure {
    private readonly _parameters: ProvisioningParameter[] = [];
    private readonly _resources: ProvisionableResource[] = [];
    private readonly _outputs: ProvisioningOutput[] = [];

    /**
     * Creates an Infrastructure with an automatic `location` parameter pre-added.
     * This mirrors the behavior of `AzureResourceInfrastructure` in Aspire's .NET library.
     */
    static withDefaultLocation(): Infrastructure {
        const infra = new Infrastructure();
        infra.add(
            new ProvisioningParameter('location', {
                description: 'The location for the resource(s) to be deployed.',
                defaultValue: resourceGroup().location,
            })
        );
        return infra;
    }

    /**
     * Adds a parameter, resource, or output to this infrastructure definition.
     */
    add(item: ProvisioningParameter | ProvisionableResource | ProvisioningOutput): this {
        if (item instanceof ProvisioningParameter) {
            this._parameters.push(item);
        } else if (item instanceof ProvisioningOutput) {
            this._outputs.push(item);
        } else {
            this._resources.push(item);
        }
        return this;
    }

    /**
     * Builds the infrastructure definition into a compiled form ready for Bicep generation.
     */
    build(): CompiledInfrastructure {
        return new CompiledInfrastructure(
            [...this._parameters],
            [...this._resources],
            [...this._outputs]
        );
    }

    /** Exposes the location parameter reference if added via `withDefaultLocation()`. */
    get locationRef() {
        const locationParam = this._parameters.find(p => p.name === 'location');
        return locationParam?.reference;
    }
}
