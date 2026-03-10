// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export { Infrastructure, CompiledInfrastructure } from './infrastructure.js';
export { ProvisioningParameter } from './parameter.js';
export type { ProvisioningParameterOptions, BicepType } from './parameter.js';
export { ProvisioningOutput } from './output.js';
export type { BicepOutputType } from './output.js';
export { ProvisionableResource, ParentResourceReference, toIdentifier } from './resource.js';
export type { ResourceBodyEntry } from './resource.js';
export {
    RawExpression,
    ResourcePropertyReference,
    ParameterReference,
    BicepInterpolation,
    bicepString,
    renderBicepValue,
    renderBicepObject,
    isBicepExpression,
    isBicepObject,
} from './expression.js';
export type { BicepExpression, BicepValue, BicepObject } from './expression.js';
export {
    resourceGroup,
    tenant,
    uniqueString,
    take,
    concat,
    literal,
    toLower,
    newGuid,
    subscription,
} from './functions.js';
