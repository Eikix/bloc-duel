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
            if [ ! -d node_modules ]; then
              echo "📦 Installing npm dependencies..."
              ${pkgs.nodejs_20}/bin/npm install
            else
              echo "✅ node_modules already exists, skipping install"
            fi
          ''}";
          availability.restart = "no";
        };

        katana = lib.mkIf common.isLinux {
          command = "${pkgs.writeShellScript "katana-start" ''
            echo "🏯 Starting Katana (Starknet devnet) on port 5050..."
            ${common.cairoPkgs.katana}/bin/katana --dev --dev.no-fee
          ''}";
          readiness_probe = healthChecks.mkKatanaHealthCheck {};
        };

        sozo-migrate = lib.mkIf common.isLinux {
          command = "${pkgs.writeShellScript "sozo-migrate" ''
            set -e
            export PATH="${common.cairoPkgs.scarb}/bin:$PATH"
            cd contracts

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

            ${pkgs.coreutils}/bin/mkdir -p ../.data
            echo "$WORLD_ADDRESS" > ../.data/world_address.txt
            echo "✅ World deployed at: $WORLD_ADDRESS"
            echo "📝 World address saved to .data/world_address.txt"
          ''}";
          depends_on."katana".condition = "process_healthy";
          availability.restart = "no";
        };

        torii = lib.mkIf common.isLinux {
          command = "${pkgs.writeShellScript "torii-start" ''
            set -e

            while [ ! -f .data/world_address.txt ]; do
              echo "⏳ Waiting for world address..."
              sleep 1
            done

            WORLD_ADDRESS=$(${pkgs.coreutils}/bin/cat .data/world_address.txt)
            DB_DIR=''${BLOCDUEL_DB_DIR:-$HOME/.cache/bloc-duel/torii-local-db}

            echo "🗂️  Starting Torii indexer for world: $WORLD_ADDRESS"
            echo "  Database:      $DB_DIR"
            echo "  GraphQL:       http://localhost:${toString common.ports.toriiPort}/graphql"

            mkdir -p "$DB_DIR"

            ${common.cairoPkgs.torii}/bin/torii \
              --world "$WORLD_ADDRESS" \
              --db-dir "$DB_DIR" \
              --http.port ${toString common.ports.toriiPort} \
              --http.cors_origins "*"
          ''}";
          depends_on."sozo-migrate".condition = "process_completed_successfully";
          readiness_probe = healthChecks.mkToriiHealthCheck {port = common.ports.toriiPort;};
        };

        vite-local = {
          command = "${pkgs.writeShellScript "vite-local-start" ''
            set -e

            echo "🚀 Starting frontend in local mode..."
            echo ""
            echo "Configuration:"
            echo "  • Mode: local contracts"
            echo "  • Frontend: http://localhost:${toString common.ports.vitePort}"
            echo "  • Torii: http://localhost:${toString common.ports.toriiPort}"
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
          };
        };
      };
    };
  };
}
