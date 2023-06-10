// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ClientOptions } from "@azure-rest/core-client";
import { BarContext } from "@msinternal/multiclient/bar/rest";
import getClient from "@msinternal/multiclient/bar/rest";

export interface BarClientOptions extends ClientOptions {}

export { BarContext } from "@msinternal/multiclient/bar/rest";

/** Bar */
export function createBar(
  endpoint: string,
  options: BarClientOptions = {}
): BarContext {
  const baseUrl = endpoint;
  const clientContext = getClient(baseUrl, options);
  return clientContext;
}
