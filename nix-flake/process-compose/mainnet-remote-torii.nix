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
            if [ ! -d node_modules ]; then
              echo "📦 Installing npm dependencies..."
              ${pkgs.nodejs_20}/bin/npm install
            else
              echo "✅ node_modules already exists, skipping install"
            fi
          ''}";
          availability.restart = "no";
        };

        preflight-check = {
          command = "${pkgs.writeShellScript "preflight-check-remote" ''
            set -e

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

            echo "🌐 Starting in Mainnet + Remote Torii mode"
            echo "========================================================"
            echo ""
            echo "Configuration:"
            echo "  • Mode: mainnet (remote Torii)"
            echo "  • Torii: $PUBLIC_TORII_URL"
            echo "  • Frontend: http://localhost:${toString common.ports.vitePort}"
            echo ""

            ${pkgs.nodejs_20}/bin/npm run dev -- --port ${toString common.ports.vitePort}
          ''}";
          depends_on = {
            "npm-install".condition = "process_completed_successfully";
            "preflight-check".condition = "process_completed_successfully";
          };
          environment = {
            NODE_ENV = "development";
          };
        };
      };
    };
  };
}
