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
      }: {
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
            program = "${config.process-compose.start.outputs.package}/bin/start";
          };

          # Start with local Torii indexing mainnet + Vite dev server
          start-mainnet = {
            type = "app";
            program = "${config.process-compose.start-mainnet.outputs.package}/bin/start-mainnet";
          };

          # Start with remote Torii + Vite dev server only (pure client)
          start-mainnet-torii = {
            type = "app";
            program = "${config.process-compose.start-mainnet-torii.outputs.package}/bin/start-mainnet-torii";
          };
        };
      };
    };
}
