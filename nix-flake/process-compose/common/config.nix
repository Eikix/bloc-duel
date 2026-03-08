{
  inputs,
  system,
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
  supportsLocalContracts = system == "x86_64-linux" || builtins.match ".*-darwin" system != null;
  cairoPkgs = inputs.cairo-nix.packages.${system};
}
