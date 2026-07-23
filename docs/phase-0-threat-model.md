# Phase 0 Threat Model

## Assets

- Clerk identity and desktop session tokens.
- Revit document contents and model mutations.
- AgentJob, route ownership, execution lease, and command identity.
- MCP relay credentials and plugin cloud credentials.
- Release/update artifacts.

## Trust boundaries

1. System browser to Datum auth broker.
2. Tauri WebView to Tauri Rust.
3. Tauri Rust to Datum APIs and Railway relay.
4. Tauri Rust to the local Revit plugin.
5. Railway MCP to relay endpoints.
6. Relay/plugin to Revit ExternalEvent execution.
7. Release CI to Windows installer and plugin payloads.

## Threats and controls

| Threat | Required control |
|---|---|
| WebView injection invokes Revit | Domain-specific Tauri commands; no generic IPC/tool command |
| Refresh-token theft | Windows Credential Manager; token never enters WebView or logs |
| Auth callback replay | PKCE, state, one-use code, short expiry, single-instance validation |
| Local process invokes Revit | Named pipe ACL plus DPAPI/HMAC nonce handshake |
| LAN process invokes Revit | No externally bound listener; loopback/named pipe only |
| Relay token replay | Short expiry, issuer/audience, jti, scope, role, instance, generation, revocation |
| Cross-user or cross-instance routing | Server-derived principal and strict connection/instance ownership checks |
| Split-brain edge owners | Server-issued route generation and owner-aware disconnect/takeover |
| Duplicate mutation | Command ID journal, execution lease, no retry after ambiguous dispatch |
| Late result overwrites terminal state | Command/lease/generation binding and terminal-state guards |
| Worker crash during mutation | Heartbeat reconciliation and `RECOVERY_REQUIRED` outcome |
| Malicious update | Tauri updater signature verification and Authenticode before broad release |
| Loaded DLL replacement | Versioned staging and deferred manifest switch while Revit is open |
| Secret leakage in diagnostics | Structured redaction and bounded details |

## Explicit residual risks

- A malicious process running as the same Windows user may be able to interfere with local user-owned resources; the bridge must minimize privilege but cannot replace Windows endpoint security.
- The relay is process-local until a distributed broker exists; production must remain one non-overlapping relay replica.
- An ambiguous Revit mutation cannot be automatically classified as success or failure without a model reconciliation operation.
- An unsigned first Windows release may trigger SmartScreen warnings despite valid package integrity.
