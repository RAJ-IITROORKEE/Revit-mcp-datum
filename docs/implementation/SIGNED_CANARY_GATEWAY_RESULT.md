# Signed Canary Gateway Result

Status: implemented and verified as a fail-closed VERIFY_ONLY artifact; live dispatch blocked
Target: DATUMM Desktop 1.1.18 / Revit 2026
Date: 2026-08-09

## Implemented

- Production Ed25519 verification for bounded, RFC 8785-canonical signed policy bundles.
- Strict duplicate-key rejection for policy bundles and the release-pinned trust root.
- Signature verification before authenticated validity-window and policy-hash classification.
- Exact broker binding to policy hash, release ID, profile ID, and catalog hash.
- Production catalog materialization from the verified signed profile only.
- The canary profile imports and exposes only `get_levels_list`.
- The additive bootstrap profile is exactly `local-revit-readonly-v3` in production verification, tests, and the policy-bundle contract.
- `send_code_to_revit`, cloud-only tools, mutations, dangerous tools, and unprofiled reads are absent from the production canary profile.
- The dedicated self-contained ESM artifact embeds the pinned public trust root and contains no gateway, dispatcher, Revit connection, cloud tool, mutation tool, private key, signing helper, test support, or policy bundle.
- Startup checks the broker-pinned SHA-256 of the exact signed bundle bytes before JSON parsing or signature verification.
- `VERIFY_ONLY` requires `readEnabled: false` and exactly zero sessions; the existing disabled gateway configuration still requires at least one bound session.
- The artifact manifest records exact byte sizes and SHA-256 hashes for every packaged payload and the embedded trust root.
- Verification requires the exact `datumm-revit-canary-verify-only.mjs` entrypoint, exact three-file artifact directory, exact manifest descriptors, and exact package payload metadata.
- Verification performs two independent builds in temporary directories, enforces the exact source import allowlist on each, requires byte-identical outputs, and compares all rebuilt files with the committed artifact.
- The artifact exposes only a public trust-root introspection mode for verification; the verifier semantically compares that embedded value with the pinned contract source.

## Deliberately Disabled

- `readEnabled` is schema-bound to `false`.
- The production entrypoint supplies no dispatcher.
- No production signed policy bundle or private signing key was created.
- No plugin transport, Revit read, mutation, or cloud fallback is reachable through this slice.
- Production bundle absence is a startup failure.

## Verification

- `npm run build`: passed.
- `npm test`: passed, 50 tests.
- `npm run test:verify-only-canary`: passed, 9 tests including entrypoint, payload, trust-root, and byte-drift tampering.
- `npm run build:verify-only-canary`: passed with a 72,762-byte output and SHA-256 `b78d5c273e42c86512c11062a9b3f08547c3b2b6349727b6c5314e1cc1e42e7e`.
- `npm run verify:verify-only-canary`: passed two deterministic temporary rebuilds, committed metadata comparison, exact hash/size, semantic trust-root, source allowlist, and forbidden-import checks.
- `npm run contracts:v2:validate`: passed, 18 schemas, 19 valid fixtures, 2 negative fixtures, and 152 tool policies.
- `npm pack --dry-run --json ./artifacts/verify-only-canary`: passed; exactly 3 files, 19,410 packed bytes, 73,658 unpacked bytes, and no bundled dependencies.
- `git diff --check`: passed with only pre-existing line-ending warnings.

## Remaining Risks And Blockers

- Release engineering has not supplied a production signed bundle matching the pinned trust root.
- The repository dependency audit reports 10 advisories: 1 low, 2 moderate, and 7 high. They were not suppressed or bypassed. The dedicated artifact package has no runtime dependencies and does not include the affected repository packages.
- The authenticated Rust-to-plugin v3 transport, plugin document identity, durable live outcome journal, and Revit `ExternalEvent` canary remain blocked.
- No clean-machine package or installed-entrypoint test has run.

## Rollback

Remove the signed-policy production module and restore the prior unsigned manifest loader/configuration. This is not an acceptable release state; local reads must remain disabled during rollback.

## Next Gate

Freeze and verify the additive plugin-v3 handshake and command contracts while plugin dispatch remains false. A live `get_levels_list` canary may proceed only after a production signed bundle, desktop gateway supervision, authenticated current-user pipe session, non-null plugin-owned document fingerprint, and durable read outcome evidence are available.
