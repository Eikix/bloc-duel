{
  description = "BLOC:DUEL - Two-player strategy card game on Starknet with Dojo";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
    systems.url = "github:nix-systems/default";
    services-flake.url = "github:juspay/services-flake";
    process-compose-flake.url = "github:Platonic-Systems/process-compose-flake";
    cairo-nix.url = "github:hadouin/cairo-nix";
    fenix = {
      url = "github:nix-community/fenix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = inputs @ {flake-parts, ...}:
    flake-parts.lib.mkFlake {inherit inputs;} {
      flake = {
        nixConfig = {
          extra-substituters = [
            "https://nix-community.cachix.org"
            "https://cache.valentin.red/cairo-nix"
          ];
          extra-trusted-public-keys = [
            "nix-community.cachix.org-1:mB9FSh9qf2dCimDSUo8Zy7bkq5CX+/rkCWyvRCYg3Fs="
            "cairo-nix:v8i37tyBwVBi/YKjomvylfaAUyk3GwvLhMaETHhxSCM="
          ];
        };
      };

      imports = [
        ./nix-flake/process-compose.nix
        ./nix-flake/devshells.nix
      ];

      systems = import inputs.systems;

      perSystem = {
        config,
        self',
        inputs',
        pkgs,
        system,
        ...
      }: let
        wrapProcessCompose = name: package: pkgs.writeShellScript name ''
          set -euo pipefail

          base_script=${package}/bin/${name}
          process_compose_path="$(${pkgs.gnugrep}/bin/grep '^export PATH="' "$base_script" | ${pkgs.coreutils}/bin/head -n1)"
          process_compose_path="''${process_compose_path#export PATH=\"}"
          process_compose_path="''${process_compose_path%:\$PATH\"}"

          config_line="$(${pkgs.gnugrep}/bin/grep 'PC_CONFIG_FILES=' "$base_script" | ${pkgs.coreutils}/bin/tail -n1)"
          config_file="''${config_line#*PC_CONFIG_FILES=}"
          config_file="''${config_file%% *}"

          export PATH="$process_compose_path:$PATH"

          if [ "$#" -eq 0 ]; then
            exec process-compose --use-uds -f "$config_file" up -t=false --keep-project
          fi

          exec process-compose --use-uds -f "$config_file" "$@"
        '';
      in {
        _module.args.pkgs = import inputs.nixpkgs {
          inherit system;
          config.allowUnfree = true;

          overlays = [
            inputs.fenix.overlays.default
          ];
        };

        apps = {
          # Start with Katana + Torii + Vite dev server (local contracts)
          start = {
            type = "app";
            program = "${wrapProcessCompose "start" config.process-compose.start.outputs.package}";
          };

          # Start with local Torii indexing mainnet + Vite dev server
          start-mainnet = {
            type = "app";
            program = "${wrapProcessCompose "start-mainnet" config.process-compose.start-mainnet.outputs.package}";
          };

          # Start with remote Torii + Vite dev server only (pure client)
          start-mainnet-torii = {
            type = "app";
            program = "${wrapProcessCompose "start-mainnet-torii" config.process-compose.start-mainnet-torii.outputs.package}";
          };
        };
      };
    };
}
