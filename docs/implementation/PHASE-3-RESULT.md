# Phase 3 Result: Fail-Closed MCP Policy Slice

Status: partially verified; runtime gateway gate blocked
Target: Revit 2026
Date: 2026-08-03

## Changed Files

MCP:

- `src/policy/local-tool-policy.ts`
- `src/policy/local-tool-policy.test.ts`
- `docs/implementation/PHASE-3-TODO.md`
- `docs/implementation/PHASE-3-RESULT.md`

No desktop application, Rust, plugin, cloud server, or transport source was
changed in this phase.

## Implemented

- Typed local policy manifest and policy index.
- Deterministic policy catalog hash verification.
- Fail-closed checks for duplicate, unknown, cloud-only, prohibited, and
  catalog-drifted tools.
- Exact local-profile registration membership validation, excluding
  `send_code_to_revit`.
- Required runtime, Revit instance, and document fingerprint context.
- Argument size limits from policy metadata.
- Retry denial for the Phase 3 local boundary.
- Local mutation denial and disabled-local-read denial.
- Bounded recursive result redaction for credentials, tokens, prompts, and
  private reasoning-like fields.
- Bounded result-size enforcement.

## Verified

- `npx tsc --noEmit`: PASS.
- Temporary-output TypeScript compilation: PASS.
- Focused compiled policy test: PASS, 4 tests.

## Partially Verified

- The policy module is pure and deterministic, but it is not wired into the
  live MCP server.
- Existing Phase 0 catalog and v2 contract validators remain the source of
  actual manifest/fixture verification.
- No local tool was dispatched by this phase.

## Blocked / Not Tested

- Live policy-gateway startup and pre-dispatch enforcement: blocked.
- Loopback-only HTTP/auth/CORS change: not implemented to avoid changing the
  combined cloud/relay server without compatibility tests.
- Runtime registration against the compiled 152-tool gateway: not enabled.
- Plugin v2 admission, Revit runtime, cloud authority, relay, mutation,
  generated C#, packaging, and clean-machine tests: not tested.

## Risks and Decisions

- The current dynamic registrar still catches registration errors and the live
  server has no centralized policy enforcement.
- The policy deliberately denies local mutation even when a manifest classifies
  a tool as mutation or dangerous.
- `send_code_to_revit` is rejected as prohibited, not merely treated as an
  ordinary dangerous tool.

## Rollback

Remove the two policy module files and Phase 3 documents. No runtime behavior
changes because the module is not wired and local execution remains disabled.

## Next Approved Work

Complete Phase 3 gateway integration only after preserving cloud compatibility
and adding startup/registration tests. Phase 4 remains blocked on plugin-v2
source/runtime admission and an approved disposable Revit 2026 model.
