import { useDojoSDK } from "@dojoengine/sdk/react";
import { useAccount } from "@starknet-react/core";
import { setupWorld } from "./contracts.gen";
import type { SchemaType } from "./models.gen";

export function useDojo() {
  const { sdk, client } = useDojoSDK<typeof setupWorld, SchemaType>();
  const { account } = useAccount();

  return {
    sdk,
    client,
    account,
  };
}
