// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {
    BicepExpression,
    BicepValue,
    BicepObject,
    isBicepObject,
    renderBicepValue,
    renderBicepObject,
    ResourcePropertyReference,
} from './expression.js';

/**
 * Represents a reference to a parent resource in a child resource's `parent` property.
 * Renders as the parent resource's Bicep identifier (unquoted).
 */
export class ParentResourceReference implements BicepExpression {
    constructor(readonly resource: ProvisionableResource) {}

    toBicep(): string {
        return this.resource.identifier;
    }
}

/**
 * Converts a resource logical name to a valid Bicep identifier.
 * Replaces hyphens and other invalid chars with underscores.
 */
export function toIdentifier(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

/**
 * A single property entry in a resource body.
 * The key is the Bicep property name; the value may be a literal, expression, nested object,
 * a parent reference, or undefined (which means the property is omitted).
 */
export type ResourceBodyEntry = [string, BicepValue<unknown> | BicepObject | ParentResourceReference | undefined];

/**
 * Abstract base class for all Azure provisioning resources.
 * Subclasses define their ARM type, API version, and body properties.
 */
export abstract class ProvisionableResource {
    /**
     * The ARM resource type, e.g. 'Microsoft.Storage/storageAccounts'.
     */
    abstract readonly armType: string;

    /**
     * The ARM API version, e.g. '2024-01-01'.
     */
    abstract readonly apiVersion: string;

    /**
     * The Bicep identifier used to reference this resource in expressions.
     * Derived from the logical name by replacing invalid chars with underscores.
     */
    readonly identifier: string;

    /**
     * The logical name of this resource (used by Aspire for resource naming).
     */
    readonly logicalName: string;

    constructor(logicalName: string) {
        this.logicalName = logicalName;
        this.identifier = toIdentifier(logicalName);
    }

    /**
     * Returns the ordered list of properties to render in the resource body.
     * Subclasses override this to define their properties.
     * Properties with `undefined` values are omitted from the output.
     */
    abstract getBodyProperties(): ResourceBodyEntry[];

    /**
     * Returns a BicepExpression referencing the given property path on this resource.
     * @example
     * storage.property('properties.primaryEndpoints.blob')
     * // renders as: storage.properties.primaryEndpoints.blob
     */
    property(path: string): BicepExpression {
        return new ResourcePropertyReference(this.identifier, path);
    }

    /**
     * Returns a BicepExpression referencing the parent of this resource (for use in `parent: <resource>`).
     */
    asParent(): ParentResourceReference {
        return new ParentResourceReference(this);
    }

    /** Renders the complete resource block to Bicep syntax. */
    toBicep(): string {
        const lines: string[] = [];
        lines.push(`resource ${this.identifier} '${this.armType}@${this.apiVersion}' = {`);

        for (const [key, value] of this.getBodyProperties()) {
            if (value === undefined || value === null) {
                continue;
            }

            const renderedKey = key.includes('-') || key.includes('.') ? `'${key}'` : key;

            if (value instanceof ParentResourceReference) {
                lines.push(`  ${renderedKey}: ${value.toBicep()}`);
            } else if (isBicepObject(value)) {
                lines.push(`  ${renderedKey}: ${renderBicepObject(value as BicepObject, 1)}`);
            } else {
                lines.push(`  ${renderedKey}: ${renderBicepValue(value as BicepValue<unknown>)}`);
            }
        }

        lines.push('}');
        return lines.join('\n');
    }
}
