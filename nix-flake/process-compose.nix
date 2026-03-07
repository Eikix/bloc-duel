{inputs, ...}: {
  imports = [
    inputs.process-compose-flake.flakeModule
    ./process-compose/local.nix
    ./process-compose/mainnet-local.nix
    ./process-compose/mainnet-remote-torii.nix
  ];
}
