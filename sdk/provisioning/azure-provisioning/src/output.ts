// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { BicepExpression, BicepValue, renderBicepValue } from './expression.js';

/**
 * The type of a Bicep output value.
 */
export type BicepOutputType = 'string' | 'int' | 'bool' | 'object' | 'array';

/**
 * Represents a Bicep `output` declaration.
 * @example
 * const blobEndpoint = new ProvisioningOutput('blobEndpoint', 'string',
 *   storage.blobEndpoint
 * );
 * // Renders as:
 * // output blobEndpoint string = storage.properties.primaryEndpoints.blob
 */
export class ProvisioningOutput {
    constructor(
        readonly name: string,
        readonly type: BicepOutputType,
        readonly value: BicepValue<unknown> | BicepExpression
    ) {}

    /** Renders this output to Bicep syntax. */
    toBicep(): string {
        return `output ${this.name} ${this.type} = ${renderBicepValue(this.value)}`;
    }
}
