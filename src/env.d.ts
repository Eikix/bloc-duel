/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PUBLIC_NODE_URL?: string
  readonly PUBLIC_NODE_URL?: string
  readonly VITE_PUBLIC_TORII_URL?: string
  readonly PUBLIC_TORII_URL?: string
  readonly VITE_PUBLIC_TORII?: string
  readonly PUBLIC_TORII?: string
  readonly VITE_PUBLIC_WORLD_ADDRESS?: string
  readonly PUBLIC_WORLD_ADDRESS?: string
  readonly VITE_PUBLIC_ACTIONS_ADDRESS?: string
  readonly PUBLIC_ACTIONS_ADDRESS?: string
  readonly VITE_PUBLIC_NAMESPACE?: string
  readonly PUBLIC_NAMESPACE?: string
  readonly VITE_PUBLIC_STARKNET_NETWORK?: string
  readonly PUBLIC_STARKNET_NETWORK?: string
  readonly VITE_PUBLIC_DEPLOY_TYPE?: string
  readonly PUBLIC_DEPLOY_TYPE?: string
  readonly VITE_PUBLIC_SLOT?: string
  readonly PUBLIC_SLOT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
