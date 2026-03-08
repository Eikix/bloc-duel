{
  inputs,
  system,
  pkgs ? null,
  ...
}: let
  # Read ports from environment variables (requires --impure flag)
  vitePort = builtins.getEnv "BLOCDUEL_VITE_PORT";
  toriiPort = builtins.getEnv "BLOCDUEL_TORII_PORT";
  relayPort = builtins.getEnv "BLOCDUEL_RELAY_PORT";
  webrtcPort = builtins.getEnv "BLOCDUEL_WEBRTC_PORT";
  websocketPort = builtins.getEnv "BLOCDUEL_WEBSOCKET_PORT";
  grpcPort = builtins.getEnv "BLOCDUEL_GRPC_PORT";
in {
  # Port configuration with defaults
  ports = {
    vitePort = if vitePort == "" then 5173 else builtins.fromJSON vitePort;
    toriiPort = if toriiPort == "" then 8080 else builtins.fromJSON toriiPort;
    relayPort = if relayPort == "" then 18090 else builtins.fromJSON relayPort;
    webrtcPort = if webrtcPort == "" then 18091 else builtins.fromJSON webrtcPort;
    websocketPort = if websocketPort == "" then 18092 else builtins.fromJSON websocketPort;
    grpcPort = if grpcPort == "" then 18093 else builtins.fromJSON grpcPort;
  };

  # System utilities
  isLinux = system == "x86_64-linux";
  isDarwin = builtins.match ".*-darwin" system != null;
  useDockerDojo = builtins.match ".*-darwin" system != null;
  supportsLocalContracts = system == "x86_64-linux" || builtins.match ".*-darwin" system != null;
  dojoDockerImage = "ghcr.io/dojoengine/dojo:v1.8.0";
  dojoDockerPlatform = "linux/amd64";
  dojoDockerNetwork = "bloc-duel-local";
  cairoPkgs = inputs.cairo-nix.packages.${system};
  macosSozo =
    if pkgs == null || !(builtins.match ".*-darwin" system != null)
    then null
    else
      pkgs.runCommand "sozo-v1.8.0-linux-amd64" {} ''
        mkdir -p "$out/bin"
        tar -xzf ${
          pkgs.fetchurl {
            url = "https://github.com/dojoengine/dojo/releases/download/v1.8.0/dojo_v1.8.0_linux_amd64.tar.gz";
            hash = "sha256-UQCVzHGQXJuv50wdt8299atiW3JCYwENaB8PNxrtp9I=";
          }
        } -C "$out/bin"
        chmod +x "$out/bin/sozo"
      '';
}
