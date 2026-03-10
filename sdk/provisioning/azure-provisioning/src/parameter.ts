// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { BicepExpression, BicepValue, ParameterReference, renderBicepValue } from './expression.js';

/**
 * The type of a Bicep parameter.
 */
export type BicepType = 'string' | 'int' | 'bool' | 'object' | 'array' | 'secureString' | 'secureObject';

/**
 * Options for creating a provisioning parameter.
 */
export interface ProvisioningParameterOptions {
    /** Bicep type of the parameter. Defaults to 'string'. */
    type?: BicepType;
    /** Description shown as @description decorator. */
    description?: string;
    /** Default value expression. */
    defaultValue?: BicepValue<unknown>;
    /** Whether the parameter is secure (uses secureString type). */
    secure?: boolean;
}

/**
 * Represents a Bicep `param` declaration.
 * @example
 * const location = new ProvisioningParameter('location', {
 *   description: 'The location for the resource(s) to be deployed.',
 *   defaultValue: resourceGroup().location,
 * });
 * // Renders as:
 * // @description('The location for the resource(s) to be deployed.')
 * // param location string = resourceGroup().location
 */
export class ProvisioningParameter {
    readonly name: string;
    readonly type: BicepType;
    readonly description: string | undefined;
    readonly defaultValue: BicepValue<unknown> | undefined;
    readonly secure: boolean;

    /** A Bicep expression that references this parameter by name. */
    readonly reference: BicepExpression;

    constructor(name: string, options: ProvisioningParameterOptions = {}) {
        this.name = name;
        this.secure = options.secure ?? false;
        this.type = options.secure ? 'secureString' : (options.type ?? 'string');
        this.description = options.description;
        this.defaultValue = options.defaultValue;
        this.reference = new ParameterReference(name);
    }

    /** Renders this parameter to Bicep syntax. */
    toBicep(): string {
        const lines: string[] = [];

        if (this.description) {
            lines.push(`@description('${this.description}')`);
        }
        if (this.secure) {
            lines.push('@secure()');
        }

        let decl = `param ${this.name} ${this.type === 'secureString' ? 'string' : this.type}`;
        if (this.defaultValue !== undefined) {
            decl += ` = ${renderBicepValue(this.defaultValue)}`;
        }
        lines.push(decl);

        return lines.join('\n');
    }
}
