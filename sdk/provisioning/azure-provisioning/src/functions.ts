// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { BicepExpression, RawExpression } from './expression.js';

/**
 * Returns an expression for `resourceGroup()`.
 */
export function resourceGroup(): { id: BicepExpression; location: BicepExpression; name: BicepExpression } {
    return {
        id: new RawExpression('resourceGroup().id'),
        location: new RawExpression('resourceGroup().location'),
        name: new RawExpression('resourceGroup().name'),
    };
}

/**
 * Returns an expression for `tenant()`.
 */
export function tenant(): { tenantId: BicepExpression } {
    return {
        tenantId: new RawExpression('tenant().tenantId'),
    };
}

/**
 * Returns a Bicep `uniqueString(...)` call expression.
 */
export function uniqueString(...args: BicepExpression[]): BicepExpression {
    const argsStr = args.map(a => a.toBicep()).join(', ');
    return new RawExpression(`uniqueString(${argsStr})`);
}

/**
 * Returns a Bicep `take(value, maxLength)` expression.
 */
export function take(value: BicepExpression, maxLength: number): BicepExpression {
    return new RawExpression(`take(${value.toBicep()}, ${maxLength})`);
}

/**
 * Returns a Bicep `concat(...)` expression.
 */
export function concat(...args: BicepExpression[]): BicepExpression {
    const argsStr = args.map(a => a.toBicep()).join(', ');
    return new RawExpression(`concat(${argsStr})`);
}

/**
 * Returns a Bicep string literal expression.
 */
export function literal(value: string): BicepExpression {
    return new RawExpression(`'${value}'`);
}

/**
 * Returns a Bicep `toLower(value)` expression.
 */
export function toLower(value: BicepExpression): BicepExpression {
    return new RawExpression(`toLower(${value.toBicep()})`);
}

/**
 * Returns a Bicep `newGuid()` expression.
 */
export function newGuid(): BicepExpression {
    return new RawExpression('newGuid()');
}

/**
 * Returns a Bicep `subscription()` access.
 */
export function subscription(): { subscriptionId: BicepExpression } {
    return {
        subscriptionId: new RawExpression('subscription().subscriptionId'),
    };
}
