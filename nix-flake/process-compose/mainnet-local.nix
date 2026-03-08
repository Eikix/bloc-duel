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
    common = import ./common/config.nix {inherit inputs pkgs system;};
    healthChecks = import ./common/health-checks.nix {inherit pkgs;};
    dockerPrelude = ''
      DOCKER_BIN=$(command -v docker || true)
      if [ -z "$DOCKER_BIN" ]; then
        echo "❌ Docker is required for the macOS mainnet-local stack"
        exit 1
      fi

      if ! "$DOCKER_BIN" info >/dev/null 2>&1; then
        echo "❌ Docker Desktop is not running"
        exit 1
      fi

      DOJO_IMAGE=''${BLOCDUEL_DOJO_IMAGE:-${common.dojoDockerImage}}
      DOJO_PLATFORM=''${BLOCDUEL_DOJO_PLATFORM:-${common.dojoDockerPlatform}}

      "$DOCKER_BIN" image inspect "$DOJO_IMAGE" >/dev/null 2>&1 || \
        "$DOCKER_BIN" pull --platform "$DOJO_PLATFORM" "$DOJO_IMAGE"
    '';
  in {
    process-compose.start-mainnet = {
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
            if [ ! -d node_modules ]; then
              echo "📦 Installing npm dependencies..."
              ${pkgs.nodejs_20}/bin/npm install
            else
              echo "✅ node_modules already exists, skipping install"
            fi
          ''}";
          availability.restart = "no";
        };

        # Preflight check: validates dojo_mainnet.toml before starting
        preflight-check = {
          command = "${pkgs.writeShellScript "preflight-check" ''
            set -e
            PROJECT_DIR="$PWD"
            if [ -n "''${PC_PROJ_DIR:-}" ] && [ "''${PC_PROJ_DIR}" != "null" ]; then
              PROJECT_DIR="$PC_PROJ_DIR"
            fi
            cd "$PROJECT_DIR"

            echo "🔍 Preflight Checks for Mainnet-Local Mode"
            echo "=========================================="
            echo ""

            normalize_address() {
              local value
              value=$(printf '%s' "$1" | ${pkgs.coreutils}/bin/tr '[:upper:]' '[:lower:]')
              value=''${value#0x}
              value=$(printf '%s' "$value" | ${pkgs.gnused}/bin/sed 's/^0*//')

              if [ -z "$value" ]; then
                value="0"
              fi

              printf '0x%s' "$value"
            }

            # Check 1: dojo_mainnet.toml exists
            if [ ! -f contracts/dojo_mainnet.toml ]; then
              echo "❌ FAILED: contracts/dojo_mainnet.toml not found!"
              echo ""
              echo "Deploy contracts first:"
              echo "  cd contracts"
              echo "  sozo -P mainnet migrate"
              echo ""
              exit 1
            fi
            echo "✅ Found contracts/dojo_mainnet.toml"

            # Check 2: mainnet manifest exists and has a world address
            if [ ! -f contracts/manifest_mainnet.json ]; then
              echo "❌ FAILED: contracts/manifest_mainnet.json not found!"
              echo ""
              echo "This should have been created during deployment."
              echo "Re-run: cd contracts && sozo -P mainnet migrate"
              echo ""
              exit 1
            fi
            echo "✅ Found contracts/manifest_mainnet.json"

            WORLD_ADDRESS=$(${pkgs.jq}/bin/jq -r '.world.address' contracts/manifest_mainnet.json)

            if [ -z "$WORLD_ADDRESS" ] || [ "$WORLD_ADDRESS" = "null" ]; then
              echo "❌ FAILED: Could not read world address from contracts/manifest_mainnet.json"
              echo ""
              echo "Steps to deploy:"
              echo "  1. cd contracts"
              echo "  2. sozo -P mainnet migrate"
              echo ""
              exit 1
            fi
            echo "✅ Manifest world address: $WORLD_ADDRESS"

            TOML_WORLD_ADDRESS=$(${pkgs.gnugrep}/bin/grep 'world_address' contracts/dojo_mainnet.toml | ${pkgs.gnused}/bin/sed 's/.*"\(.*\)".*/\1/' | ${pkgs.coreutils}/bin/tr -d ' ' || true)
            if [ -n "$TOML_WORLD_ADDRESS" ] && [ "$(normalize_address "$TOML_WORLD_ADDRESS")" != "$(normalize_address "$WORLD_ADDRESS")" ]; then
              echo "❌ FAILED: dojo_mainnet.toml world_address does not match contracts/manifest_mainnet.json"
              echo "  dojo_mainnet.toml:        $TOML_WORLD_ADDRESS"
              echo "  manifest_mainnet.json:   $WORLD_ADDRESS"
              echo ""
              echo "Update contracts/dojo_mainnet.toml to match the deployed manifest."
              echo ""
              exit 1
            fi
            echo "✅ dojo_mainnet.toml matches manifest_mainnet.json"

            # Check 3: world_block is set
            WORLD_BLOCK=$(${pkgs.gnugrep}/bin/grep 'world_block' contracts/dojo_mainnet.toml | ${pkgs.gnused}/bin/sed 's/.*= *\([0-9]*\).*/\1/')

            if [ -z "$WORLD_BLOCK" ] || [ "$WORLD_BLOCK" = "" ] || [ "$WORLD_BLOCK" = "0" ]; then
              echo "⚠️  WARNING: world_block not set (will sync from genesis - slow!)"
              echo "   Recommended: Set world_block in dojo_mainnet.toml to deployment block"
            else
              echo "✅ Starting from block: $WORLD_BLOCK"
            fi

            echo ""
            echo "✅ All preflight checks passed!"
            echo "🚀 Starting Torii and Frontend..."
            echo ""

            exit 0
          ''}";
          availability.restart = "no";
        };

        # Torii indexing mainnet contracts
        torii-mainnet = {
          command = if common.useDockerDojo then "${pkgs.writeShellScript "torii-mainnet-start-darwin" ''
            set -e
            PROJECT_DIR="$PWD"
            if [ -n "''${PC_PROJ_DIR:-}" ] && [ "''${PC_PROJ_DIR}" != "null" ]; then
              PROJECT_DIR="$PC_PROJ_DIR"
            fi
            cd "$PROJECT_DIR"
            ${dockerPrelude}

            WORLD_ADDRESS=$(${pkgs.jq}/bin/jq -r '.world.address' contracts/manifest_mainnet.json)
            WORLD_BLOCK=$(${pkgs.gnugrep}/bin/grep 'world_block' contracts/dojo_mainnet.toml | ${pkgs.gnused}/bin/sed 's/.*= *\([0-9]*\).*/\1/')

            if [ -z "$WORLD_BLOCK" ] || [ "$WORLD_BLOCK" = "" ]; then
              WORLD_BLOCK="0"
            fi

            DB_DIR=''${BLOCDUEL_DB_DIR:-$HOME/.cache/bloc-duel/torii-mainnet-db}
            RELAY_PORT=''${BLOCDUEL_RELAY_PORT:-${toString common.ports.relayPort}}
            WEBRTC_PORT=''${BLOCDUEL_WEBRTC_PORT:-${toString common.ports.webrtcPort}}
            WEBSOCKET_PORT=''${BLOCDUEL_WEBSOCKET_PORT:-${toString common.ports.websocketPort}}
            GRPC_PORT=''${BLOCDUEL_GRPC_PORT:-${toString common.ports.grpcPort}}

            mkdir -p "$DB_DIR"
            "$DOCKER_BIN" rm -f bloc-duel-torii-mainnet >/dev/null 2>&1 || true

            echo "🌍 Starting Torii for Mainnet Contracts"
            echo "========================================"
            echo ""
            echo "  World Address: $WORLD_ADDRESS"
            echo "  Start Block:   $WORLD_BLOCK"
            echo "  RPC:           https://api.cartridge.gg/x/starknet/mainnet"
            echo "  Database:      $DB_DIR"
            echo "  Listen:        http://127.0.0.1:${toString common.ports.toriiPort}"
            echo ""
            echo "📊 GraphQL playground: http://localhost:${toString common.ports.toriiPort}/graphql"
            echo ""

            exec "$DOCKER_BIN" run --rm --name bloc-duel-torii-mainnet \
              --platform "$DOJO_PLATFORM" \
              --user "$(${pkgs.coreutils}/bin/id -u):$(${pkgs.coreutils}/bin/id -g)" \
              -e HOME=/tmp/bloc-duel \
              -p ${toString common.ports.toriiPort}:${toString common.ports.toriiPort} \
              -p "$RELAY_PORT:$RELAY_PORT" \
              -p "$WEBRTC_PORT:$WEBRTC_PORT" \
              -p "$WEBSOCKET_PORT:$WEBSOCKET_PORT" \
              -p "$GRPC_PORT:$GRPC_PORT" \
              -v "$DB_DIR:/workspace/.torii" \
              "$DOJO_IMAGE" \
              sh -lc "/opt/asdf/installs/torii/1.8.3/bin/torii --world \"$WORLD_ADDRESS\" --rpc https://api.cartridge.gg/x/starknet/mainnet --db-dir /workspace/.torii --http.addr 0.0.0.0 --http.port ${toString common.ports.toriiPort} --http.cors_origins '*' --indexing.world_block \"$WORLD_BLOCK\" --relay.port $RELAY_PORT --relay.webrtc_port $WEBRTC_PORT --relay.websocket_port $WEBSOCKET_PORT --grpc.addr 0.0.0.0 --grpc.port $GRPC_PORT"
          ''}" else "${pkgs.writeShellScript "torii-mainnet-start" ''
            set -e
            PROJECT_DIR="$PWD"
            if [ -n "''${PC_PROJ_DIR:-}" ] && [ "''${PC_PROJ_DIR}" != "null" ]; then
              PROJECT_DIR="$PC_PROJ_DIR"
            fi
            cd "$PROJECT_DIR"

            # Read configuration (already validated by preflight-check)
            WORLD_ADDRESS=$(${pkgs.jq}/bin/jq -r '.world.address' contracts/manifest_mainnet.json)
            WORLD_BLOCK=$(${pkgs.gnugrep}/bin/grep 'world_block' contracts/dojo_mainnet.toml | ${pkgs.gnused}/bin/sed 's/.*= *\([0-9]*\).*/\1/')

            # Default to 0 if world_block not set
            if [ -z "$WORLD_BLOCK" ] || [ "$WORLD_BLOCK" = "" ]; then
              WORLD_BLOCK="0"
            fi

            DB_DIR=''${BLOCDUEL_DB_DIR:-$HOME/.cache/bloc-duel/torii-mainnet-db}
            RELAY_PORT=''${BLOCDUEL_RELAY_PORT:-${toString common.ports.relayPort}}
            WEBRTC_PORT=''${BLOCDUEL_WEBRTC_PORT:-${toString common.ports.webrtcPort}}
            WEBSOCKET_PORT=''${BLOCDUEL_WEBSOCKET_PORT:-${toString common.ports.websocketPort}}
            GRPC_PORT=''${BLOCDUEL_GRPC_PORT:-${toString common.ports.grpcPort}}

            echo "🌍 Starting Torii for Mainnet Contracts"
            echo "========================================"
            echo ""
            echo "  World Address: $WORLD_ADDRESS"
            echo "  Start Block:   $WORLD_BLOCK"
            echo "  RPC:           https://api.cartridge.gg/x/starknet/mainnet"
            echo "  Database:      $DB_DIR"
            echo "  Listen:        http://127.0.0.1:${toString common.ports.toriiPort}"
            echo ""
            echo "📊 GraphQL playground: http://localhost:${toString common.ports.toriiPort}/graphql"
            echo ""

            mkdir -p "$DB_DIR"

            ${common.cairoPkgs.torii}/bin/torii \
              --world "$WORLD_ADDRESS" \
              --rpc https://api.cartridge.gg/x/starknet/mainnet \
              --db-dir "$DB_DIR" \
              --http.port ${toString common.ports.toriiPort} \
              --http.cors_origins "*" \
              --indexing.world_block "$WORLD_BLOCK" \
              --relay.port $RELAY_PORT \
              --relay.webrtc_port $WEBRTC_PORT \
              --relay.websocket_port $WEBSOCKET_PORT \
              --grpc.port $GRPC_PORT
          ''}";
          depends_on."preflight-check".condition = "process_completed_successfully";
          readiness_probe =
            if common.useDockerDojo
            then
              healthChecks.mkToriiHealthCheck {port = common.ports.toriiPort;}
              // {
                initial_delay_seconds = 10;
                period_seconds = 5;
                failure_threshold = 60;
                timeout_seconds = 5;
              }
            else healthChecks.mkToriiHealthCheck {port = common.ports.toriiPort;};
        };

        # Vite dev server in mainnet-local mode
        vite-mainnet = {
          command = "${pkgs.writeShellScript "vite-mainnet-start" ''
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

            echo "🚀 Starting frontend in mainnet-local mode..."
            echo ""
            echo "Configuration:"
            echo "  • Mode: mainnet-local"
            echo "  • Frontend: http://localhost:${toString common.ports.vitePort}"
            echo "  • Torii: http://localhost:${toString common.ports.toriiPort}"
            echo "  • World: $PUBLIC_WORLD_ADDRESS"
            echo "  • Actions: $PUBLIC_ACTIONS_ADDRESS"
            echo ""

            ${pkgs.nodejs_20}/bin/npm run dev -- --port ${toString common.ports.vitePort}
          ''}";
          depends_on = {
            "npm-install".condition = "process_completed_successfully";
            "preflight-check".condition = "process_completed_successfully";
            "torii-mainnet".condition = "process_healthy";
          };
          environment = {
            NODE_ENV = "development";
            PUBLIC_DOJO_MANIFEST_PROFILE = "mainnet";
            PUBLIC_NODE_URL = "https://api.cartridge.gg/x/starknet/mainnet";
            PUBLIC_STARKNET_NETWORK = "mainnet";
            PUBLIC_TORII_URL = "http://127.0.0.1:${toString common.ports.toriiPort}";
            BLOCDUEL_USE_MKCERT = "0";
          };
        };
      };
    };
  };
}
