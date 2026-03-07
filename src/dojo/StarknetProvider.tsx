import { ControllerConnector } from "@cartridge/connector";
import { StarknetConfig, jsonRpcProvider } from "@starknet-react/core";
import type { Chain } from "@starknet-react/chains";
import type { ReactNode } from "react";
import { dojoConfig } from "./dojoConfig";

const RPC_URL = "http://localhost:5050";

const katana: Chain = {
  id: BigInt("0x4b4154414e41"),
  network: "katana",
  name: "Katana Local",
  nativeCurrency: {
    address: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [RPC_URL] },
    public: { http: [RPC_URL] },
  },
  paymasterRpcUrls: {
    avnu: { http: [RPC_URL] },
  },
  testnet: true,
};

const actionsAddress = dojoConfig.manifest.contracts[0]?.address ?? "";

const sessionPolicies = {
  contracts: {
    [actionsAddress]: {
      methods: [
        { name: "Create game", entrypoint: "create_game" },
        { name: "Join game", entrypoint: "join_game" },
        { name: "Play card", entrypoint: "play_card" },
        { name: "Discard card", entrypoint: "discard_card" },
        { name: "Invoke hero", entrypoint: "invoke_hero" },
        { name: "Choose system bonus", entrypoint: "choose_system_bonus" },
        { name: "Next age", entrypoint: "next_age" },
      ],
    },
  },
};

const connector = new ControllerConnector({
  chains: [{ rpcUrl: RPC_URL }],
  policies: sessionPolicies,
});

interface StarknetProviderProps {
  children: ReactNode;
}

export function StarknetProvider({ children }: StarknetProviderProps) {
  return (
    <StarknetConfig
      chains={[katana]}
      provider={jsonRpcProvider({ rpc: () => ({ nodeUrl: RPC_URL }) })}
      connectors={[connector]}
      autoConnect
      defaultChainId={katana.id}
    >
      {children}
    </StarknetConfig>
  );
}
