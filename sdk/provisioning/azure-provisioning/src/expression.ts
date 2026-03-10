// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Represents a Bicep expression that can be rendered to a Bicep string.
 */
export interface BicepExpression {
    /** Renders this expression to a Bicep syntax string. */
    toBicep(): string;
}

/**
 * A Bicep value that can be either a literal TypeScript value or a Bicep expression.
 * Literal strings are rendered with single quotes, booleans and numbers as-is.
 */
export type BicepValue<T> = T | BicepExpression;

/**
 * Checks whether a value is a BicepExpression.
 */
export function isBicepExpression(value: unknown): value is BicepExpression {
    return (
        typeof value === 'object' &&
        value !== null &&
        'toBicep' in value &&
        typeof (value as BicepExpression).toBicep === 'function'
    );
}

/**
 * A raw Bicep expression string passed through unchanged.
 */
export class RawExpression implements BicepExpression {
    constructor(private readonly bicepText: string) {}

    toBicep(): string {
        return this.bicepText;
    }
}

/**
 * A reference to another resource's property (e.g., storage.properties.primaryEndpoints.blob).
 */
export class ResourcePropertyReference implements BicepExpression {
    constructor(
        private readonly resourceIdentifier: string,
        private readonly propertyPath: string
    ) {}

    toBicep(): string {
        return `${this.resourceIdentifier}.${this.propertyPath}`;
    }
}

/**
 * A reference to a parameter by name.
 */
export class ParameterReference implements BicepExpression {
    constructor(readonly parameterName: string) {}

    toBicep(): string {
        return this.parameterName;
    }
}

/**
 * A Bicep string interpolation — produces `'prefix${expr}suffix'` syntax.
 */
export class BicepInterpolation implements BicepExpression {
    constructor(
        private readonly parts: string[],
        private readonly expressions: BicepExpression[]
    ) {}

    toBicep(): string {
        let result = "'";
        for (let i = 0; i < this.parts.length; i++) {
            result += this.parts[i];
            if (i < this.expressions.length) {
                result += '${' + this.expressions[i].toBicep() + '}';
            }
        }
        result += "'";
        return result;
    }
}

/**
 * Creates a Bicep string interpolation using a tagged template literal.
 * @example
 * const name = bicep`storage${uniqueString(resourceGroup().id)}`;
 * // renders as: 'storage${uniqueString(resourceGroup().id)}'
 */
export function bicepString(
    parts: TemplateStringsArray,
    ...expressions: BicepExpression[]
): BicepExpression {
    return new BicepInterpolation(Array.from(parts), expressions);
}

/**
 * Renders a BicepValue to a Bicep syntax string.
 */
export function renderBicepValue(value: BicepValue<unknown>): string {
    if (isBicepExpression(value)) {
        return value.toBicep();
    }
    if (typeof value === 'string') {
        return `'${value}'`;
    }
    if (typeof value === 'boolean' || typeof value === 'number') {
        return String(value);
    }
    if (value === null || value === undefined) {
        return 'null';
    }
    return `'${String(value)}'`;
}

/**
 * Represents a nested Bicep object literal.
 * Keys must have defined values (undefined values are skipped).
 */
export interface BicepObject {
    [key: string]: BicepValue<unknown> | BicepObject | undefined;
}

/** Returns true if the value looks like a plain BicepObject (not an expression or primitive). */
export function isBicepObject(value: unknown): value is BicepObject {
    return (
        typeof value === 'object' &&
        value !== null &&
        !isBicepExpression(value) &&
        !Array.isArray(value)
    );
}

/**
 * Renders a BicepObject to indented Bicep syntax.
 */
export function renderBicepObject(obj: BicepObject, indentLevel: number = 0): string {
    const baseIndent = '  '.repeat(indentLevel);
    const innerIndent = '  '.repeat(indentLevel + 1);
    const entries = Object.entries(obj).filter(([, v]) => v !== undefined && v !== null);
    if (entries.length === 0) {
        return '{}';
    }

    const lines: string[] = ['{'];
    for (const [key, value] of entries) {
        const renderedKey = key.includes('-') || key.includes('.') ? `'${key}'` : key;
        if (isBicepObject(value)) {
            lines.push(`${innerIndent}${renderedKey}: ${renderBicepObject(value as BicepObject, indentLevel + 1)}`);
        } else {
            lines.push(`${innerIndent}${renderedKey}: ${renderBicepValue(value as BicepValue<unknown>)}`);
        }
    }
    lines.push(`${baseIndent}}`);
    return lines.join('\n');
}
