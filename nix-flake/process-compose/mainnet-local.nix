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
    process-compose.start-mainnet = {
      imports = [
        inputs.services-flake.processComposeModules.default
      ];

      settings.processes = {
        npm-install = {
          command = "${pkgs.writeShellScript "npm-install" ''
            set -e
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

            echo "🔍 Preflight Checks for Mainnet-Local Mode"
            echo "=========================================="
            echo ""

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

            # Check 2: world_address is set
            WORLD_ADDRESS=$(${pkgs.gnugrep}/bin/grep 'world_address' contracts/dojo_mainnet.toml | ${pkgs.gnused}/bin/sed 's/.*"\(.*\)".*/\1/' | ${pkgs.coreutils}/bin/tr -d ' ')

            if [ -z "$WORLD_ADDRESS" ] || [ "$WORLD_ADDRESS" = "" ]; then
              echo "❌ FAILED: world_address not set in contracts/dojo_mainnet.toml"
              echo ""
              echo "Steps to deploy:"
              echo "  1. cd contracts"
              echo "  2. sozo -P mainnet migrate"
              echo "  3. Copy the world address from output"
              echo "  4. Update contracts/dojo_mainnet.toml:"
              echo "     world_address = \"0x...\""
              echo "     world_block = <block_number>"
              echo ""
              exit 1
            fi
            echo "✅ World address: $WORLD_ADDRESS"

            # Check 3: world_block is set
            WORLD_BLOCK=$(${pkgs.gnugrep}/bin/grep 'world_block' contracts/dojo_mainnet.toml | ${pkgs.gnused}/bin/sed 's/.*= *\([0-9]*\).*/\1/')

            if [ -z "$WORLD_BLOCK" ] || [ "$WORLD_BLOCK" = "" ] || [ "$WORLD_BLOCK" = "0" ]; then
              echo "⚠️  WARNING: world_block not set (will sync from genesis - slow!)"
              echo "   Recommended: Set world_block in dojo_mainnet.toml to deployment block"
            else
              echo "✅ Starting from block: $WORLD_BLOCK"
            fi

            # Check 4: manifest exists
            if [ ! -f contracts/manifest_mainnet.json ]; then
              echo "❌ FAILED: contracts/manifest_mainnet.json not found!"
              echo ""
              echo "This should have been created during deployment."
              echo "Re-run: cd contracts && sozo -P mainnet migrate"
              echo ""
              exit 1
            fi
            echo "✅ Found contracts/manifest_mainnet.json"

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
          command = "${pkgs.writeShellScript "torii-mainnet-start" ''
            set -e

            # Read configuration (already validated by preflight-check)
            WORLD_ADDRESS=$(${pkgs.gnugrep}/bin/grep 'world_address' contracts/dojo_mainnet.toml | ${pkgs.gnused}/bin/sed 's/.*"\(.*\)".*/\1/' | ${pkgs.coreutils}/bin/tr -d ' ')
            WORLD_BLOCK=$(${pkgs.gnugrep}/bin/grep 'world_block' contracts/dojo_mainnet.toml | ${pkgs.gnused}/bin/sed 's/.*= *\([0-9]*\).*/\1/')

            # Default to 0 if world_block not set
            if [ -z "$WORLD_BLOCK" ] || [ "$WORLD_BLOCK" = "" ]; then
              WORLD_BLOCK="0"
            fi

            DB_DIR=''${BLOCDUEL_DB_DIR:-$HOME/.cache/bloc-duel/torii-mainnet-db}
            RELAY_PORT=''${BLOCDUEL_RELAY_PORT:-18090}
            WEBRTC_PORT=''${BLOCDUEL_WEBRTC_PORT:-18091}
            WEBSOCKET_PORT=''${BLOCDUEL_WEBSOCKET_PORT:-18092}
            GRPC_PORT=''${BLOCDUEL_GRPC_PORT:-50051}

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
          readiness_probe = healthChecks.mkToriiHealthCheck {port = common.ports.toriiPort;};
        };

        # Vite dev server in mainnet-local mode
        vite-mainnet = {
          command = "${pkgs.writeShellScript "vite-mainnet-start" ''
            set -e

            echo "🚀 Starting frontend in mainnet-local mode..."
            echo ""
            echo "Configuration:"
            echo "  • Mode: mainnet-local"
            echo "  • Frontend: http://localhost:${toString common.ports.vitePort}"
            echo "  • Torii: http://localhost:${toString common.ports.toriiPort}"
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
          };
        };
      };
    };
  };
}
