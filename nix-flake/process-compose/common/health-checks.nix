{pkgs}: {
  # Torii GraphQL health check
  mkToriiHealthCheck = {
    host ? "localhost",
    port ? 8080,
  }: {
    exec.command = "${pkgs.writeShellScript "torii-health" ''
      ${pkgs.curl}/bin/curl -sf http://${host}:${toString port}/graphql \
        -H "Content-Type: application/json" \
        -d '{"query":"{ __schema { queryType { name } } }"}' \
        | ${pkgs.jq}/bin/jq -e '.data' > /dev/null
    ''}";
    initial_delay_seconds = 5;
    period_seconds = 2;
  };

  # Katana JSON-RPC health check
  mkKatanaHealthCheck = {port ? 5050}: {
    exec.command = "${pkgs.writeShellScript "katana-health" ''
      ${pkgs.curl}/bin/curl -sf -X POST http://localhost:${toString port} \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","method":"starknet_chainId","params":[],"id":1}' \
        | ${pkgs.jq}/bin/jq -e '.result' > /dev/null
    ''}";
    initial_delay_seconds = 2;
    period_seconds = 1;
  };
}
