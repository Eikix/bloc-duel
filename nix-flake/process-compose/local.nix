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
        echo "❌ Docker is required for the macOS local stack"
        exit 1
      fi

      if ! "$DOCKER_BIN" info >/dev/null 2>&1; then
        echo "❌ Docker Desktop is not running"
        exit 1
      fi

      DOJO_IMAGE=''${BLOCDUEL_DOJO_IMAGE:-${common.dojoDockerImage}}
      DOJO_PLATFORM=''${BLOCDUEL_DOJO_PLATFORM:-${common.dojoDockerPlatform}}
      DOJO_NETWORK=''${BLOCDUEL_DOCKER_NETWORK:-${common.dojoDockerNetwork}}

      "$DOCKER_BIN" network inspect "$DOJO_NETWORK" >/dev/null 2>&1 || \
        "$DOCKER_BIN" network create "$DOJO_NETWORK" >/dev/null

      "$DOCKER_BIN" image inspect "$DOJO_IMAGE" >/dev/null 2>&1 || \
        "$DOCKER_BIN" pull --platform "$DOJO_PLATFORM" "$DOJO_IMAGE"
    '';
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
            if [ ! -d node_modules ]; then
              echo "📦 Installing npm dependencies..."
              ${pkgs.nodejs_20}/bin/npm install
            else
              echo "✅ node_modules already exists, skipping install"
            fi
          ''}";
          availability.restart = "no";
        };

        katana = lib.mkIf common.supportsLocalContracts {
          command = if common.useDockerDojo then "${pkgs.writeShellScript "katana-start-darwin" ''
            set -e
            PROJECT_DIR="$PWD"
            if [ -n "''${PC_PROJ_DIR:-}" ] && [ "''${PC_PROJ_DIR}" != "null" ]; then
              PROJECT_DIR="$PC_PROJ_DIR"
            fi
            cd "$PROJECT_DIR"
            ${dockerPrelude}

            "$DOCKER_BIN" rm -f bloc-duel-katana >/dev/null 2>&1 || true

            echo "🏯 Starting Katana (Docker ${common.dojoDockerPlatform}) on port 5050..."
            exec "$DOCKER_BIN" run --rm --name bloc-duel-katana \
              --platform "$DOJO_PLATFORM" \
              --network "$DOJO_NETWORK" \
              -p 5050:5050 \
              -v "$PROJECT_DIR/contracts:/workspace/contracts" \
              -w /workspace/contracts \
              "$DOJO_IMAGE" \
              sh -lc '/opt/asdf/installs/katana/1.7.0/bin/katana --config katana.toml --http.addr 0.0.0.0'
          ''}" else "${pkgs.writeShellScript "katana-start" ''
            set -e
            PROJECT_DIR="$PWD"
            if [ -n "''${PC_PROJ_DIR:-}" ] && [ "''${PC_PROJ_DIR}" != "null" ]; then
              PROJECT_DIR="$PC_PROJ_DIR"
            fi
            cd "$PROJECT_DIR"
            echo "🏯 Starting Katana (Starknet devnet) on port 5050..."
            ${common.cairoPkgs.katana}/bin/katana --config contracts/katana.toml
          ''}";
          readiness_probe =
            if common.useDockerDojo
            then
              healthChecks.mkKatanaHealthCheck {}
              // {
                initial_delay_seconds = 20;
                period_seconds = 5;
                failure_threshold = 60;
                timeout_seconds = 5;
              }
            else healthChecks.mkKatanaHealthCheck {};
        };

        sozo-migrate = lib.mkIf common.supportsLocalContracts {
          command = if common.useDockerDojo then "${pkgs.writeShellScript "sozo-migrate-darwin" ''
            set -e
            PROJECT_DIR="$PWD"
            if [ -n "''${PC_PROJ_DIR:-}" ] && [ "''${PC_PROJ_DIR}" != "null" ]; then
              PROJECT_DIR="$PC_PROJ_DIR"
            fi
            ${dockerPrelude}
            TMP_DIR=$(${pkgs.coreutils}/bin/mktemp -d)
            trap 'rm -rf "$TMP_DIR"' EXIT
            DOCKER_HOME="$PROJECT_DIR/.data/docker-home"
            mkdir -p "$DOCKER_HOME/.cache"
            cp "${common.macosSozo}/bin/sozo" "$TMP_DIR/sozo"
            chmod +x "$TMP_DIR/sozo"

            ${pkgs.gnused}/bin/sed 's|http://localhost:5050/|http://bloc-duel-katana:5050/|' \
              "$PROJECT_DIR/contracts/dojo_dev.toml" > "$TMP_DIR/dojo_dev.toml"

            echo "🔨 Building Dojo contracts..."
            "$DOCKER_BIN" run --rm --name bloc-duel-sozo-build \
              --platform "$DOJO_PLATFORM" \
              --network "$DOJO_NETWORK" \
              --user "$(${pkgs.coreutils}/bin/id -u):$(${pkgs.coreutils}/bin/id -g)" \
              -e HOME=/workspace/.data/docker-home \
              -e XDG_CACHE_HOME=/workspace/.data/docker-home/.cache \
              -e SCARB=/opt/asdf/installs/scarb/2.13.1/bin/scarb \
              -v "$PROJECT_DIR:/workspace" \
              -v "$TMP_DIR/sozo:/tmp/sozo:ro" \
              -v "$TMP_DIR/dojo_dev.toml:/workspace/contracts/dojo_dev.toml:ro" \
              -w /workspace/contracts \
              "$DOJO_IMAGE" \
              sh -lc '/tmp/sozo build'

            echo ""
            echo "🚀 Migrating Dojo contracts to Katana..."
            "$DOCKER_BIN" run --rm --name bloc-duel-sozo-migrate \
              --platform "$DOJO_PLATFORM" \
              --network "$DOJO_NETWORK" \
              --user "$(${pkgs.coreutils}/bin/id -u):$(${pkgs.coreutils}/bin/id -g)" \
              -e HOME=/workspace/.data/docker-home \
              -e XDG_CACHE_HOME=/workspace/.data/docker-home/.cache \
              -e SCARB=/opt/asdf/installs/scarb/2.13.1/bin/scarb \
              -v "$PROJECT_DIR:/workspace" \
              -v "$TMP_DIR/sozo:/tmp/sozo:ro" \
              -v "$TMP_DIR/dojo_dev.toml:/workspace/contracts/dojo_dev.toml:ro" \
              -w /workspace/contracts \
              "$DOJO_IMAGE" \
              sh -lc '/tmp/sozo migrate'

            WORLD_ADDRESS=$(${pkgs.jq}/bin/jq -r '.world.address' "$PROJECT_DIR/contracts/manifest_dev.json")
            if [ -z "$WORLD_ADDRESS" ] || [ "$WORLD_ADDRESS" = "null" ]; then
              echo "❌ Error: Could not extract world address from manifest_dev.json"
              exit 1
            fi

            ${pkgs.coreutils}/bin/mkdir -p "$PROJECT_DIR/.data"
            echo "$WORLD_ADDRESS" > "$PROJECT_DIR/.data/world_address.txt"
            echo "✅ World deployed at: $WORLD_ADDRESS"
            echo "📝 World address saved to .data/world_address.txt"
          ''}" else "${pkgs.writeShellScript "sozo-migrate" ''
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

        torii = lib.mkIf common.supportsLocalContracts {
          command = if common.useDockerDojo then "${pkgs.writeShellScript "torii-start-darwin" ''
            set -e
            PROJECT_DIR="$PWD"
            if [ -n "''${PC_PROJ_DIR:-}" ] && [ "''${PC_PROJ_DIR}" != "null" ]; then
              PROJECT_DIR="$PC_PROJ_DIR"
            fi
            ${dockerPrelude}

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

            mkdir -p "$DB_DIR"
            "$DOCKER_BIN" rm -f bloc-duel-torii >/dev/null 2>&1 || true

            echo "🗂️  Starting Torii indexer for world: $WORLD_ADDRESS"
            echo "  Database:      $DB_DIR"
            echo "  GraphQL:       http://localhost:${toString common.ports.toriiPort}/graphql"

            exec "$DOCKER_BIN" run --rm --name bloc-duel-torii \
              --platform "$DOJO_PLATFORM" \
              --network "$DOJO_NETWORK" \
              --user "$(${pkgs.coreutils}/bin/id -u):$(${pkgs.coreutils}/bin/id -g)" \
              -e HOME=/tmp/bloc-duel \
              -p ${toString common.ports.toriiPort}:${toString common.ports.toriiPort} \
              -p "$RELAY_PORT:$RELAY_PORT" \
              -p "$WEBRTC_PORT:$WEBRTC_PORT" \
              -p "$WEBSOCKET_PORT:$WEBSOCKET_PORT" \
              -p "$GRPC_PORT:$GRPC_PORT" \
              -v "$DB_DIR:/workspace/.torii" \
              "$DOJO_IMAGE" \
              sh -lc "/opt/asdf/installs/torii/1.8.3/bin/torii --world \"$WORLD_ADDRESS\" --rpc http://bloc-duel-katana:5050 --db-dir /workspace/.torii --http.addr 0.0.0.0 --http.port ${toString common.ports.toriiPort} --http.cors_origins '*' --relay.port $RELAY_PORT --relay.webrtc_port $WEBRTC_PORT --relay.websocket_port $WEBSOCKET_PORT --grpc.addr 0.0.0.0 --grpc.port $GRPC_PORT"
          ''}" else "${pkgs.writeShellScript "torii-start" ''
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
          } // lib.optionalAttrs common.supportsLocalContracts {
            "torii".condition = "process_healthy";
          };
          environment = {
            NODE_ENV = "development";
            PUBLIC_DOJO_MANIFEST_PROFILE = "dev";
            PUBLIC_NODE_URL = "http://127.0.0.1:5050";
            PUBLIC_STARKNET_NETWORK = "katana";
            PUBLIC_TORII_URL = "http://127.0.0.1:${toString common.ports.toriiPort}";
            BLOCDUEL_USE_MKCERT = "0";
          };
        };
      };
    };
  };
}
