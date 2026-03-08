{inputs, ...}: {
  imports = [
    inputs.process-compose-flake.flakeModule
  ];

  perSystem = {
    config,
    lib,
    pkgs,
    system,
    ...
  }: let
    common = import ./common/config.nix {inherit inputs system;};
    healthChecks = import ./common/health-checks.nix {inherit pkgs;};
  in {
    process-compose.start = {
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

        katana = lib.mkIf common.isLinux {
          command = "${pkgs.writeShellScript "katana-start" ''
            set -e
            PROJECT_DIR="$PWD"
            if [ -n "''${PC_PROJ_DIR:-}" ] && [ "''${PC_PROJ_DIR}" != "null" ]; then
              PROJECT_DIR="$PC_PROJ_DIR"
            fi
            cd "$PROJECT_DIR"
            echo "🏯 Starting Katana (Starknet devnet) on port 5050..."
            ${common.cairoPkgs.katana}/bin/katana --config contracts/katana.toml
          ''}";
          readiness_probe = healthChecks.mkKatanaHealthCheck {};
        };

        sozo-migrate = lib.mkIf common.isLinux {
          command = "${pkgs.writeShellScript "sozo-migrate" ''
            set -e
            export PATH="${common.cairoPkgs.scarb}/bin:$PATH"
            PROJECT_DIR="$PWD"
            if [ -n "''${PC_PROJ_DIR:-}" ] && [ "''${PC_PROJ_DIR}" != "null" ]; then
              PROJECT_DIR="$PC_PROJ_DIR"
            fi
            cd "$PROJECT_DIR/contracts"

            echo "🔨 Building Dojo contracts..."
            ${pkgs.util-linux}/bin/script -q -e -c "${common.cairoPkgs.sozo}/bin/sozo build" /dev/null

            echo ""
            echo "🚀 Migrating Dojo contracts to Katana..."
            ${pkgs.util-linux}/bin/script -q -e -c "${common.cairoPkgs.sozo}/bin/sozo migrate" /dev/null

            WORLD_ADDRESS=$(${pkgs.jq}/bin/jq -r '.world.address' manifest_dev.json)
            if [ -z "$WORLD_ADDRESS" ] || [ "$WORLD_ADDRESS" = "null" ]; then
              echo "❌ Error: Could not extract world address from manifest_dev.json"
              exit 1
            fi

            ${pkgs.coreutils}/bin/mkdir -p "$PROJECT_DIR/.data"
            echo "$WORLD_ADDRESS" > "$PROJECT_DIR/.data/world_address.txt"
            echo "✅ World deployed at: $WORLD_ADDRESS"
            echo "📝 World address saved to .data/world_address.txt"
          ''}";
          depends_on."katana".condition = "process_healthy";
          availability.restart = "no";
        };

        torii = lib.mkIf common.isLinux {
          command = "${pkgs.writeShellScript "torii-start" ''
            set -e
            PROJECT_DIR="$PWD"
            if [ -n "''${PC_PROJ_DIR:-}" ] && [ "''${PC_PROJ_DIR}" != "null" ]; then
              PROJECT_DIR="$PC_PROJ_DIR"
            fi

            while [ ! -f "$PROJECT_DIR/.data/world_address.txt" ]; do
              echo "⏳ Waiting for world address..."
              sleep 1
            done

            WORLD_ADDRESS=$(${pkgs.coreutils}/bin/cat "$PROJECT_DIR/.data/world_address.txt")
            DB_DIR=''${BLOCDUEL_DB_DIR:-$HOME/.cache/bloc-duel/torii-local-db}
            RELAY_PORT=''${BLOCDUEL_RELAY_PORT:-${toString common.ports.relayPort}}
            WEBRTC_PORT=''${BLOCDUEL_WEBRTC_PORT:-${toString common.ports.webrtcPort}}
            WEBSOCKET_PORT=''${BLOCDUEL_WEBSOCKET_PORT:-${toString common.ports.websocketPort}}
            GRPC_PORT=''${BLOCDUEL_GRPC_PORT:-${toString common.ports.grpcPort}}

            echo "🗂️  Starting Torii indexer for world: $WORLD_ADDRESS"
            echo "  Database:      $DB_DIR"
            echo "  GraphQL:       http://localhost:${toString common.ports.toriiPort}/graphql"

            mkdir -p "$DB_DIR"

            ${common.cairoPkgs.torii}/bin/torii \
              --world "$WORLD_ADDRESS" \
              --db-dir "$DB_DIR" \
              --http.port ${toString common.ports.toriiPort} \
              --http.cors_origins "*" \
              --relay.port $RELAY_PORT \
              --relay.webrtc_port $WEBRTC_PORT \
              --relay.websocket_port $WEBSOCKET_PORT \
              --grpc.port $GRPC_PORT
          ''}";
          depends_on."sozo-migrate".condition = "process_completed_successfully";
          readiness_probe = healthChecks.mkToriiHealthCheck {port = common.ports.toriiPort;};
        };

        vite-local = {
          command = "${pkgs.writeShellScript "vite-local-start" ''
            set -e
            PROJECT_DIR="$PWD"
            if [ -n "''${PC_PROJ_DIR:-}" ] && [ "''${PC_PROJ_DIR}" != "null" ]; then
              PROJECT_DIR="$PC_PROJ_DIR"
            fi
            cd "$PROJECT_DIR"

            WORLD_ADDRESS=$(${pkgs.jq}/bin/jq -r '.world.address' contracts/manifest_dev.json)
            ACTIONS_ADDRESS=$(${pkgs.jq}/bin/jq -r '.contracts[] | select(.tag == "bloc_duel-actions") | .address' contracts/manifest_dev.json)

            if [ -z "$WORLD_ADDRESS" ] || [ "$WORLD_ADDRESS" = "null" ]; then
              echo "❌ FAILED: Could not read world address from contracts/manifest_dev.json"
              exit 1
            fi

            if [ -z "$ACTIONS_ADDRESS" ] || [ "$ACTIONS_ADDRESS" = "null" ]; then
              echo "❌ FAILED: Could not read actions address from contracts/manifest_dev.json"
              exit 1
            fi

            export PUBLIC_WORLD_ADDRESS="$WORLD_ADDRESS"
            export PUBLIC_ACTIONS_ADDRESS="$ACTIONS_ADDRESS"

            echo "🚀 Starting frontend in local mode..."
            echo ""
            echo "Configuration:"
            echo "  • Mode: local contracts"
            echo "  • Frontend: http://localhost:${toString common.ports.vitePort}"
            echo "  • Torii: http://localhost:${toString common.ports.toriiPort}"
            echo "  • World: $PUBLIC_WORLD_ADDRESS"
            echo "  • Actions: $PUBLIC_ACTIONS_ADDRESS"
            echo ""

            ${pkgs.nodejs_20}/bin/npm run dev -- --port ${toString common.ports.vitePort}
          ''}";
          depends_on = {
            "npm-install".condition = "process_completed_successfully";
          } // lib.optionalAttrs common.isLinux {
            "torii".condition = "process_healthy";
          };
          environment = {
            NODE_ENV = "development";
            PUBLIC_DOJO_MANIFEST_PROFILE = "dev";
            PUBLIC_NODE_URL = "http://127.0.0.1:5050";
            PUBLIC_STARKNET_NETWORK = "katana";
            PUBLIC_TORII_URL = "http://127.0.0.1:${toString common.ports.toriiPort}";
          };
        };
      };
    };
  };
}
