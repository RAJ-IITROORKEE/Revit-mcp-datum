import { createLocalGateway, type TrustedRuntimeContext } from "./gateway.js";
import { FramedStdioServerTransport } from "./framed-stdio.js";
import { loadSignedLocalGatewayCatalogFile } from "./manifest-loader.js";
import { createLocalMcpServer } from "./mcp-server.js";
import { parseLocalGatewayConfig } from "./config.js";

async function main(): Promise<void> {
  const config = parseLocalGatewayConfig(process.env.DATUMM_LOCAL_GATEWAY_CONFIG_JSON);
  const catalog = await loadSignedLocalGatewayCatalogFile(config.policyBundlePath, {
    policyHash: config.expectedPolicyHash,
    policyReleaseId: config.expectedPolicyReleaseId,
    profileId: config.expectedPolicyProfileId,
    catalogHash: config.expectedCatalogHash,
  });
  const sessions = new Map<string, TrustedRuntimeContext>(
    config.sessions.map((session) => [session.connectionId, session]),
  );
  const gateway = createLocalGateway({
    catalog,
    readEnabled: false,
    resolveTrustedSession: (connectionId) => sessions.get(connectionId),
  });
  const server = createLocalMcpServer(gateway);
  const transport = new FramedStdioServerTransport(process.stdin, process.stdout, config.maxFrameBytes);
  await server.connect(transport);
  await transport.closedPromise;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Local gateway failed";
  process.stderr.write(`[local-gateway] ${message.slice(0, 500)}\n`);
  process.exitCode = 1;
});
