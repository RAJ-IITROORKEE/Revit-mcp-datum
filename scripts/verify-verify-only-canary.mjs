import { join } from "node:path";
import { verifyCommittedCanaryArtifact } from "./verify-only-canary-lib.mjs";

const manifest = await verifyCommittedCanaryArtifact(join("artifacts", "verify-only-canary"));
console.log(`Verified ${manifest.entrypoint}: two deterministic rebuilds match committed artifact and package metadata.`);
