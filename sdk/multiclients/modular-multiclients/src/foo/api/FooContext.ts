// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ClientOptions } from "@azure-rest/core-client";
import { FooContext } from "@msinternal/multiclient/foo/rest";
import getClient from "@msinternal/multiclient/foo/rest";

export interface FooClientOptions extends ClientOptions {}

export { FooContext } from "@msinternal/multiclient/foo/rest";

/** Cadl Foo */
export function createFoo(
  endpoint: string,
  options: FooClientOptions = {}
): FooContext {
  const baseUrl = endpoint;
  const clientContext = getClient(baseUrl, options);
  return clientContext;
}
