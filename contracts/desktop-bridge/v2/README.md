# Desktop Local Runtime Contract v2

This directory is the canonical cross-language contract for desktop-local BUILD execution. It is additive beside `v1`; existing desktop releases continue using their shipped compatibility path.

## Guarantees

- Protocol identity is explicit and versioned.
- A job has one execution host, runtime, Revit instance, route generation, and lease epoch.
- Plugin command dispatch is journaled and deduplicated by `commandId`.
- An ambiguous mutation returns `OUTCOME_UNKNOWN` and cannot be retried automatically.
- Events are durable, ordered, replayable, and contain public execution summaries only.
- Questions and dangerous permissions are separate request types.
- Todos are ordered projections of the validated plan, not mutation authority.
- Rich plans use millimeters and carry exact revision/fingerprint identity.
- The desktop-local catalog has exactly 152 Revit-backed tools.
- The negotiated frame maximum is mandatory and never exceeds 8 MiB; receivers reject oversized lengths before allocation or JSON parsing.
- Mutation commands bind to an approved plan revision, executable step, canonical payload hash, and idempotency identity. Dangerous commands additionally require a server-issued permission grant.

## Canonical Hashes

Hashes use SHA-256 over RFC 8785 JSON Canonicalization Scheme bytes. Plan fingerprints cover immutable public design content but exclude mutable status, timestamps, capability flags, and execution-snapshot references. The immutable execution snapshot binds that plan fingerprint to complete validated arguments, the signed policy catalog, job/runtime/Revit/document identity, order, dependencies, mutation classes, timeouts, and per-step payload hashes. `executionSnapshotHash` covers the complete snapshot excluding only `snapshotHash`. This non-circular projection lets the public plan reference the trusted executable snapshot while carrying only sanitized argument summaries.

Command `payloadHash` covers protocol version, job/runtime/connection/Revit identities, route generation, lease epoch, state version, document fingerprint, tool, full validated arguments, mutation class, plan identity, step ID, deadline, idempotency key, and session tag. A permission grant is server-issued and bound to this payload hash, user/device, document, lease epoch, and expiry.

Step authorizations and permission grants use Ed25519. Signed bytes are the UTF-8 RFC 8785 canonical JSON representation of the complete object excluding only `signature`. `signature` is unpadded base64url. `issuer` and `kid` identify the trusted Datum cloud key; consumers reject unknown issuers/keys, expired grants, and any claim mismatch. A repeated authorization/grant JTI is accepted only when `commandId`, `payloadHash`, signed bytes, and permission grant are byte-identical to the journaled command; it returns the existing journal state and never dispatches again. Reuse with any different binding fails closed. The committed fixtures use the public RFC 8032 test-vector key and are not production credentials.

At every admission boundary, `mutationClass`, retry policy, frame limits, and created-ID requirements are derived from a production-signed release envelope around `tool-policy-manifest.json`. Client-provided classifications never override policy. Multi-action tools such as `operate_element` and `optimize_model` are conservatively classified as dangerous. `fixtures/signed-tool-policy-manifest.json` is test-only and uses the public fixture key; production release signing is a separate offline step and consumers never trust the fixture key.

## Consumers

- Datum cloud runtime APIs and persistence adapters
- Datumm Desktop Rust broker and React reducer
- secretless Node agent sidecar
- Revit plugin CommandDispatcher
- local MCP catalog and policy loader

Every consumer must validate the protocol version and reject incompatible payloads. Source generation or direct source reuse across TypeScript, Rust, and C# is allowed only after the fixtures pass in each owning repository.

## Authenticated Named Pipe

Handshake messages are four-byte unsigned big-endian length-prefixed UTF-8 JSON and must validate against `pipe-handshake.schema.json`. Client and server nonces are 32 random bytes encoded as unpadded base64url. The server accepts only protocol v2, a timestamp within the configured replay window, the selected Revit instance, and a frame maximum no larger than 8 MiB.

The plugin creates `sessionId` in the challenge. The transcript is RFC 8785 canonical JSON over protocol version, session ID, desktop device/runtime/Revit identity, plugin PID/version, signed catalog hash, negotiated frame maximum, both nonces, and both Unix-millisecond timestamps. `transcriptHash` is SHA-256 of those bytes. Mutual proofs are HMAC-SHA256 with the separate DPAPI CurrentUser bridge secret over `datumm-pipe-v2:<server-proof|client-proof>:` followed by the 32 transcript-hash bytes. Proofs are unpadded base64url. The final accepted message carries `serverFinishedMac`, computed with the plugin-to-client session key over the complete accepted message excluding only that MAC; clients verify it before accepting the session ID, frame limit, or initial sequences.

After mutual proof, each direction derives a 32-byte key with HKDF-SHA256: input key material is the bridge secret, salt is the transcript-hash bytes, and info is UTF-8 `datumm-pipe-v2:<client-to-plugin|plugin-to-client>`. Frame sequence starts at 1 independently in each direction and increments exactly once. The frame MAC is HMAC-SHA256 over RFC 8785 canonical JSON of the full `authenticated-frame` object excluding only `mac`. Receivers verify frame length before allocation, then session, direction, exact sequence, payload hash, and MAC before parsing or dispatching the payload. Any downgrade, reflection, replay, gap, duplicate, malformed frame, or authentication failure closes the pipe without dispatch.
