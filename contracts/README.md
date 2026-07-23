# Datumm Cross-Repository Contracts

This directory is the canonical source for the versioned local bridge and edge-routing contracts shared by:

- Datumm Desktop (Tauri/Rust/TypeScript)
- the Datumm Revit plugin (C#)
- the Railway relay and MCP service (TypeScript)

These files describe protocol boundaries only. They do not authorize the current legacy socket, relay, or plugin implementations to accept the new protocol.

## Phase 0 Contract Rules

- Protocol version `1` is a specification baseline, not a compatibility promise for the current production transport.
- Every command has a `commandId`, job identity, Revit-instance identity, route generation, execution lease epoch, and document fingerprint.
- Responses echo routing identity and use explicit outcome states.
- Mutation commands are never automatically retried after dispatch becomes ambiguous.
- A route owner is selected by the cloud lease authority; clients cannot self-assign ownership.
- Unknown outcomes require reconciliation before a route or job can be replayed.
- JSON fixtures are language-neutral and must remain valid in TypeScript, Rust, and C# test runners.

## Layout

```text
contracts/desktop-bridge/v1/
  bridge-command.schema.json
  bridge-response.schema.json
  relay-session-claims.schema.json
  job-event.schema.json
  fixtures/
docs/phase-0-state-machines.md
```

Run the dependency-free validator from the repository root:

```text
node scripts/validate-desktop-contracts.mjs
```

The schemas intentionally avoid a runtime validation dependency in Phase 0. Runtime adapters will use native validators in their owning repositories after the contract gate is approved.
