import { init } from "@dojoengine/sdk";
import { DojoSdkProvider } from "@dojoengine/sdk/react";
import { useEffect, useState, type ReactNode } from "react";
import { dojoConfig } from "./dojoConfig";
import { setupWorld } from "./contracts.gen";
import type { SchemaType } from "./models.gen";

interface DojoProviderProps {
  children: ReactNode;
}

export function DojoProvider({ children }: DojoProviderProps) {
  const [sdk, setSdk] = useState<Awaited<ReturnType<typeof init<SchemaType>>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        const worldAddress = dojoConfig.manifest.world.address;

        const clientConfig = {
          worldAddress,
          toriiUrl: "http://localhost:8080",
          relayUrl: "",
        };

        const nextSdk = await init<SchemaType>({
          client: {
            ...clientConfig,
          },
          domain: {
            name: "BlocDuel",
            version: "1.0",
            chainId: "KATANA",
            revision: "1",
          },
        });

        if (!mounted) return;
        setSdk(nextSdk);
      } catch (err) {
        if (!mounted) return;
        const message = err instanceof Error ? err.message : "Failed to initialize Dojo SDK";
        setError(message);
      }
    }

    void initialize();

    return () => {
      mounted = false;
    };
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4 text-center">
        <div className="rounded-xl border border-border bg-surface-raised p-6">
          <p className="font-mono text-xs text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!sdk) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />
      </div>
    );
  }

  return (
    <DojoSdkProvider sdk={sdk} dojoConfig={dojoConfig} clientFn={setupWorld}>
      {children}
    </DojoSdkProvider>
  );
}
