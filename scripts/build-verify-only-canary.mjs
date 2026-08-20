import { join } from "node:path";
import { ARTIFACT_ENTRYPOINT, buildCanaryArtifact } from "./verify-only-canary-lib.mjs";

const outputDirectory = join("artifacts", "verify-only-canary");
const manifest = await buildCanaryArtifact(outputDirectory);
console.log(`Built ${join(outputDirectory, ARTIFACT_ENTRYPOINT)} (${manifest.files[0].size} bytes, ${manifest.files[0].sha256}).`);
