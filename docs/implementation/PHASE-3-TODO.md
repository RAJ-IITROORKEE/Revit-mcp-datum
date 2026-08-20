# Phase 3 TODO: Fail-Closed MCP Policy

Status: partially implemented; runtime gateway gate blocked
Target: Revit 2026
Scope: pure policy boundary and deterministic tests only

## Constraints

- Do not modify the plugin, cloud server, Revit model, or existing Copilot
  endpoints.
- Do not enable local execution or local mutation.
- Do not change transport, install dependencies, run destructive build scripts,
  commit, or push.
- Preserve unrelated MCP worktree changes.

## Completed

- [x] Add manifest/policy types and deterministic catalog hash verification.
- [x] Reject duplicate, unknown, cloud-only, and prohibited local tools.
- [x] Add exact registered-profile membership validation.
- [x] Require runtime, Revit instance, and document context.
- [x] Enforce argument bounds and deny automatic retries.
- [x] Deny local mutation and disabled local read execution.
- [x] Redact sensitive/private result fields and enforce result bounds.
- [x] Add focused policy tests.

## Blocked Follow-up

- [ ] Wire the policy into a dedicated local gateway startup path.
- [ ] Make runtime registration fail closed against the actual 152-tool catalog.
- [ ] Add authenticated loopback HTTP or stdio integration without changing
  the cloud relay deployment.
- [ ] Add central serialized dispatch and plugin-v2 admission checks.

## Gate

The pure policy contract is locally verified. Phase 3 is not complete because
the live MCP server does not yet load this policy or enforce it before plugin
dispatch. Local execution remains disabled.
