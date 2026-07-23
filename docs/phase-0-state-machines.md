# Phase 0 State Machines

## Route ownership

```text
NO_OWNER
  -> CLAIMING(generation + 1)
  -> OWNED(owner, generation)

OWNED
  -> DRAINING when takeover is authorized
  -> NO_OWNER after active commands complete
  -> RECOVERY_REQUIRED when an active mutation becomes unknown

DRAINING
  -> OWNED(new owner, generation + 1) only after the old owner is idle
  -> RECOVERY_REQUIRED if the active command outcome is unknown
```

An old endpoint may not release or overwrite a newer generation.

## Execution lease

```text
QUEUED
  -> CLAIMED(job, leaseEpoch)
  -> RUNNING

RUNNING
  -> COMPLETED
  -> FAILED
  -> CANCELLED only before dispatch
  -> RECOVERY_REQUIRED after an ambiguous mutation

CLAIMED/RUNNING
  -> STALE_RECONCILIATION when the heartbeat expires
  -> RECOVERY_REQUIRED if mutation dispatch cannot be proven absent
```

Only an atomic lease owner may progress a job. Terminal states cannot be revived by a late worker or late tool response.

## Command outcomes

```text
NOT_DISPATCHED
  -> CANCELLED_BEFORE_DISPATCH
  -> DISPATCHED

DISPATCHED
  -> COMPLETED
  -> FAILED_DEFINITIVE
  -> OUTCOME_UNKNOWN

OUTCOME_UNKNOWN
  -> RECOVERY_REQUIRED
  -> COMPLETED only after external reconciliation
  -> FAILED_DEFINITIVE only after external reconciliation
```

Read commands can use bounded retries before `DISPATCHED`. Mutation commands must not be retried after `DISPATCHED` unless a future idempotency/reconciliation protocol explicitly proves safety.
