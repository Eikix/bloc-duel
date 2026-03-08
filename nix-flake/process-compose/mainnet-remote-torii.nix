{inputs, ...}: {
  imports = [
    inputs.process-compose-flake.flakeModule
  ];

  perSystem = {
    config,
    pkgs,
    system,
    ...
  }: let
    common = import ./common/config.nix {inherit inputs system;};
  in {
    process-compose.start-mainnet-torii = {
      imports = [
        inputs.services-flake.processComposeModules.default
      ];

      settings.processes = {
        npm-install = {
          command = "${pkgs.writeShellScript "npm-install" ''
            set -e
            PROJECT_DIR="$PWD"
            if [ -n "''${PC_PROJ_DIR:-}" ] && [ "''${PC_PROJ_DIR}" != "null" ]; then
              PROJECT_DIR="$PC_PROJ_DIR"
            fi
            cd "$PROJECT_DIR"
            NPM="${pkgs.nodejs_20}/bin/npm"
            NODE="${pkgs.nodejs_20}/bin/node"
            STAMP_FILE="node_modules/.bloc-duel-node-version"
            TARGET_NODE_VERSION=$("$NODE" --version)
            REINSTALL_REASON=""

            if [ ! -d node_modules ]; then
              REINSTALL_REASON="node_modules is missing"
            elif [ ! -f "$STAMP_FILE" ]; then
              REINSTALL_REASON="node_modules was not installed by the Nix launcher"
            else
              INSTALLED_NODE_VERSION=$(<"$STAMP_FILE")
              if [ "$INSTALLED_NODE_VERSION" != "$TARGET_NODE_VERSION" ]; then
                REINSTALL_REASON="node_modules was built with Node.js $INSTALLED_NODE_VERSION (expected $TARGET_NODE_VERSION)"
              elif ! "$NPM" ls --depth=0 > /dev/null 2>&1; then
                REINSTALL_REASON="npm dependency tree is incomplete or out of sync"
              fi
            fi

            if [ -n "$REINSTALL_REASON" ]; then
              echo "🔄 $REINSTALL_REASON"
              echo "📦 Installing npm dependencies with Node.js $TARGET_NODE_VERSION..."
              ${pkgs.coreutils}/bin/rm -rf node_modules
              "$NPM" install --include=dev
              ${pkgs.coreutils}/bin/mkdir -p node_modules
              printf '%s\n' "$TARGET_NODE_VERSION" > "$STAMP_FILE"
            else
              echo "✅ npm dependencies are already in sync"
            fi
          ''}";
          availability.restart = "no";
        };

        preflight-check = {
          command = "${pkgs.writeShellScript "preflight-check-remote" ''
            set -e
            PROJECT_DIR="$PWD"
            if [ -n "''${PC_PROJ_DIR:-}" ] && [ "''${PC_PROJ_DIR}" != "null" ]; then
              PROJECT_DIR="$PC_PROJ_DIR"
            fi
            cd "$PROJECT_DIR"

            echo "🔍 Preflight Checks for Mainnet + Remote Torii Mode"
            echo "=================================================="
            echo ""

            TORII_URL=''${PUBLIC_TORII_URL:-}

            if [ -z "$TORII_URL" ]; then
              echo "❌ FAILED: PUBLIC_TORII_URL environment variable is not set!"
              echo ""
              echo "Set it to your remote Torii URL, e.g.:"
              echo "  export PUBLIC_TORII_URL=https://api.cartridge.gg/x/bloc-duel/torii"
              echo "  nix run .#start-mainnet-torii"
              echo ""
              exit 1
            fi
            echo "✅ Torii URL: $TORII_URL"

            if [ ! -f contracts/manifest_mainnet.json ]; then
              echo "❌ FAILED: contracts/manifest_mainnet.json not found!"
              echo ""
              echo "Re-run: cd contracts && sozo -P mainnet migrate"
              echo ""
              exit 1
            fi

            WORLD_ADDRESS=$(${pkgs.jq}/bin/jq -r '.world.address' contracts/manifest_mainnet.json)
            if [ -z "$WORLD_ADDRESS" ] || [ "$WORLD_ADDRESS" = "null" ]; then
              echo "❌ FAILED: Could not read world address from contracts/manifest_mainnet.json"
              exit 1
            fi
            echo "✅ Manifest world address: $WORLD_ADDRESS"

            echo ""
            echo "✅ All preflight checks passed!"
            echo "🚀 Starting Frontend..."
            echo ""
          ''}";
          availability.restart = "no";
        };

        vite-mainnet-torii = {
          command = "${pkgs.writeShellScript "vite-mainnet-torii-start" ''
            set -e
            PROJECT_DIR="$PWD"
            if [ -n "''${PC_PROJ_DIR:-}" ] && [ "''${PC_PROJ_DIR}" != "null" ]; then
              PROJECT_DIR="$PC_PROJ_DIR"
            fi
            cd "$PROJECT_DIR"

            WORLD_ADDRESS=$(${pkgs.jq}/bin/jq -r '.world.address' contracts/manifest_mainnet.json)
            ACTIONS_ADDRESS=$(${pkgs.jq}/bin/jq -r '.contracts[] | select(.tag == "bloc_duel-actions") | .address' contracts/manifest_mainnet.json)

            if [ -z "$WORLD_ADDRESS" ] || [ "$WORLD_ADDRESS" = "null" ]; then
              echo "❌ FAILED: Could not read world address from contracts/manifest_mainnet.json"
              exit 1
            fi

            if [ -z "$ACTIONS_ADDRESS" ] || [ "$ACTIONS_ADDRESS" = "null" ]; then
              echo "❌ FAILED: Could not read actions address from contracts/manifest_mainnet.json"
              exit 1
            fi

            export PUBLIC_WORLD_ADDRESS="$WORLD_ADDRESS"
            export PUBLIC_ACTIONS_ADDRESS="$ACTIONS_ADDRESS"

            echo "🌐 Starting in Mainnet + Remote Torii mode"
            echo "========================================================"
            echo ""
            echo "Configuration:"
            echo "  • Mode: mainnet (remote Torii)"
            echo "  • Torii: $PUBLIC_TORII_URL"
            echo "  • Frontend: http://localhost:${toString common.ports.vitePort}"
            echo "  • World: $PUBLIC_WORLD_ADDRESS"
            echo "  • Actions: $PUBLIC_ACTIONS_ADDRESS"
            echo ""

            ${pkgs.nodejs_20}/bin/npm run dev -- --port ${toString common.ports.vitePort}
          ''}";
          depends_on = {
            "npm-install".condition = "process_completed_successfully";
            "preflight-check".condition = "process_completed_successfully";
          };
          environment = {
            NODE_ENV = "development";
            PUBLIC_DOJO_MANIFEST_PROFILE = "mainnet";
            PUBLIC_NODE_URL = "https://api.cartridge.gg/x/starknet/mainnet";
            PUBLIC_STARKNET_NETWORK = "mainnet";
          };
        };
      };
    };
  };
}
