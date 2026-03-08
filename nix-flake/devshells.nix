{inputs, ...}: {
  perSystem = {
    config,
    pkgs,
    lib,
    system,
    ...
  }: let
    cairo-nix = inputs.cairo-nix.packages.${system};
    common = import ./process-compose/common/config.nix {inherit inputs system;};
  in {
    devShells.default = pkgs.mkShell {
      packages = with pkgs;
        [
          # Git and basic tools
          git
          jq

          # Node.js and npm
          nodejs_20

          # Cargo dependencies
          (fenix.stable.withComponents [
            "cargo"
            "clippy"
            "rust-src"
            "rustc"
            "rustfmt"
            "rust-analyzer"
          ])
          openssl

          # Protobuf for torii
          protobuf
        ]
        ++ lib.optionals common.isLinux (with pkgs; [
          systemd
          udev
          libusb1
          pkgs.stdenv.cc.cc

          pkg-config

          gcc
        ])
        ++ [
          cairo-nix.sozo
          cairo-nix.katana
          cairo-nix.torii
          cairo-nix.scarb
          cairo-nix.starkli
        ];

      env = {
        LD_LIBRARY_PATH = lib.makeLibraryPath ([
            pkgs.stdenv.cc.cc.lib
            pkgs.openssl
          ]
          ++ lib.optionals (system == "x86_64-linux") [
            pkgs.libgccjit
            pkgs.udev
          ]);
      };

      shellHook = ''
        echo "🎴 BLOC:DUEL development environment"
        echo "Node.js: $(node --version)"
        echo "🔧 Cairo/Starknet tools: sozo, katana, torii, scarb, starkli"

        # Create data directory
        export PRJ_DATA_DIR="$PWD/.data"
        mkdir -p "$PRJ_DATA_DIR"

        # Create start command
        start() {
          echo "🚀 Starting BLOC:DUEL local contracts environment..."
          nix run .#start
        }

        echo ""
        echo "💡 Quick start: run 'start' to launch Katana + Torii + Vite"
        echo "💡 Or run 'nix run .#start' directly"
      '';
    };
  };
}
