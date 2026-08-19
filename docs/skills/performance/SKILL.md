---
name: performance
description: Use when something is slow, when a change could plausibly make something slow, or when asked to optimize. Enforces measuring before changing - establish a baseline, find where the time or memory actually goes, fix the dominant cost, then measure again. Covers algorithmic complexity, the latency hierarchy, database and network round trips, N+1 access patterns, batching, caching, pagination, serialization cost, concurrency and parallelism, memory and allocation, bundle size, rendering cost, and cold start. Triggers on "this is slow", "optimize this", "reduce latency", "high memory or CPU", "improve load time", "will this scale", or reviewing a change on a hot path. Rejects speculative micro-optimization and premature caching. Not for choosing a container type - use data-structures for that.
metadata:
  category: foundation
  version: "1.0.0"
---

# Performance

> **Rule strength:** MUST / NEVER are mandatory. SHOULD is the default — deviate only with a stated reason. CONSIDER is a judgment call.

## Measure first

**MUST** establish, before changing anything:

1. **What is slow, in numbers.** Which operation, at which percentile, on what input size. "The page is slow" is not a starting point; "p95 of `GET /orders` is 2.4s" is.
2. **What the target is.** Without one you cannot tell when to stop.
3. **Where the time actually goes.** Profile, trace, time the segments, or read the query plan. **NEVER** guess.

**NEVER** apply an optimization without a measurement showing the cost you are removing is the dominant one. Speculative optimization adds complexity, risks correctness, and usually targets the wrong thing.

The measurement MUST reflect production conditions that matter: realistic data volume, realistic concurrency, a production build. A query fast against 100 rows tells you nothing about 10 million; a bundle measured in development mode tells you nothing about what ships.

## Find the dominant cost

Optimize the largest contributor. Halving something that accounts for 3% of the time is not worth the complexity it adds.

Order of magnitude matters more than anything else. Approximate relative costs, worth internalizing because they decide where to look:

```
CPU / in-memory operation        nanoseconds
Main memory access               ~100 nanoseconds
SSD read                         tens of microseconds
Same-datacenter network round trip   ~0.5 milliseconds
Database query (indexed, local)  ~1 millisecond
Cross-region round trip          tens to hundreds of milliseconds
Cold start of a runtime          hundreds of milliseconds to seconds
```

The practical consequence: **round trips dominate**. One query returning 1,000 rows beats 1,000 queries returning one row, even though the total data is identical. Before optimizing loops, count the I/O operations.

## Complexity

Algorithmic complexity is the one thing you should reason about *before* measuring, because it determines whether the code will survive growth.

- Identify the complexity of any code whose input can grow: `O(n)`, `O(n log n)`, `O(n²)`.
- **Nested iteration over two collections is the most common accidental `O(n²)`.** Replace the inner scan with a hash-based lookup built once. See the `data-structures` skill.
- Watch for hidden complexity: a linear scan inside a loop, a sort inside a loop, string concatenation in a loop in languages where strings are immutable, a length or count operation that is not constant time.
- Constant factors matter at small `n`. A linear scan over 10 items beats building a hash map. Do not add machinery for collections that are always small.

Complexity is about **growth**, not speed. `O(n)` code can still be slow, and `O(n²)` over a guaranteed 5 elements is fine.

## I/O and round trips

The highest-value fixes in most applications are here.

- **N+1 access** — fetching a collection then querying once per element. Fix by batching into one query or eager-loading the relation. Look for any I/O call inside a loop or inside a per-item map. See the `database` skill.
- **Sequential independent calls** — awaiting one request, then another, when neither depends on the other. Issue them concurrently. This is often the single largest win on a page or endpoint.
- **Over-fetching** — selecting columns, fields, or related objects nothing uses. Costs bandwidth, serialization, and memory at every hop.
- **Unbounded result sets** — every list operation MUST have a limit. Absent pagination is both a performance and an availability defect. See `api-design`.
- **Chatty integrations** — prefer one batch endpoint call over many single-item calls where the remote supports it.
- **Missing indexes** — confirm with the query plan, never by assumption. See the `database` skill.

## Caching

A cache is the last resort, not the first move. It introduces a second source of truth and a staleness question that never fully goes away.

**MUST** answer all four before adding one:

1. What exactly is cached?
2. What key identifies it — including every input that affects the result, such as tenant, user, locale, and permission scope?
3. How long does it live?
4. How does it become invalid?

If you cannot answer (4), use a short TTL. Time-based expiry fails predictably; manual invalidation fails silently.

Prefer, in order: **remove the work** → **make the work cheaper** → **do the work once per request** (memoize in-request) → **cache across requests**.

- **NEVER** cache under a key missing the tenant or user scope when the value is scoped to them. That serves one customer's data to another, which is a security defect, not a performance bug.
- **NEVER** cache authorization decisions without a deliberate, short expiry.
- A cache must fall through to the source when unavailable, not fail the request.
- Guard against stampedes when a hot key expires.

Cache placement and invalidation in service code is owned by the `backend-engineering` skill.

## Memory

- Watch for unbounded growth: caches without eviction, collections that only ever accumulate, listeners and subscriptions never removed, closures retaining large objects.
- Stream large payloads rather than loading them fully into memory. Reading a large file, export, or result set entirely is the usual cause of a container being killed under load.
- Process large datasets in bounded batches rather than all at once.
- Prefer reusing buffers and avoiding allocation in genuinely hot loops — but only after profiling shows allocation is the cost.

## Concurrency and parallelism

- Parallelize **independent** work; it does not help work that is serially dependent.
- Bound concurrency. Unlimited parallel requests exhaust connection pools, file descriptors, and downstream rate limits — converting your speed-up into an outage.
- Recognize the bottleneck type: CPU-bound work needs more cores or less work; I/O-bound work needs more concurrency; lock contention needs a smaller critical section.
- Keep critical sections short, and never perform I/O while holding a lock.

Retries, timeouts, and backoff are owned by the `backend-engineering` skill; they interact with performance because a retry storm looks like a performance problem.

## Client and rendering cost

Applies to any client application — web, mobile, or desktop.

- **Payload size** is usually the dominant cost on first load. Split by route, defer what is not immediately needed, and check what a new dependency adds before accepting it. See `dependency-management`.
- **Rendering long lists** is the usual cause of a janky list. Render only what is visible.
- **Layout and reflow**: batch changes, avoid interleaving reads and writes of layout properties, and reserve space for content that loads late.
- **Images and assets**: correctly sized, appropriately compressed, with dimensions declared.
- **Avoid re-rendering work that has not changed** — but apply memoization to a measured problem. Memoizing everything adds comparison cost and bugs.

Framework-specific rendering rules live in the `frameworks/*` skills.

## Verify and stop

**MUST**, after the change:

1. Re-measure the same way as the baseline, and report the before and after numbers.
2. Confirm behavior is unchanged — an optimization that alters results is a defect. Run the tests.
3. Check you did not move the cost somewhere invisible (more memory, more staleness, more complexity).
4. Stop when the target is met.

**NEVER** claim a performance improvement without a measurement. "Should be faster" is not a result.

Record why a non-obvious optimization exists, so a future reader does not simplify it away. See the `documentation` skill.

## Anti-patterns

| Anti-pattern | Correct approach |
|---|---|
| Optimizing without profiling | Measure, then fix the dominant cost |
| Micro-optimizing while an N+1 query remains | Fix the round trips first |
| Adding a cache to hide a slow query | Fix the query; cache only if still needed |
| Caching without an invalidation answer | Use a short TTL, or do not cache |
| Adding an index per slow query without checking the plan | Confirm with the query plan; watch write cost |
| Unbounded parallelism to "go faster" | Bound the concurrency |
| Loading an entire dataset into memory | Stream or batch |
| Memoizing everything preemptively | Memoize a measured cost |
| Rewriting in a faster language before profiling | Find the actual bottleneck first |
| Reporting an improvement with no numbers | Re-measure and state before and after |

## Related skills

- `data-structures` — choosing the container that makes the operation cheap.
- `database` — query plans, indexes, N+1, pagination.
- `backend-engineering` — caching placement, concurrency, timeouts.
- `frontend-engineering` — client-side loading and interaction cost.
- `debugging` — the same evidence-first discipline applied to defects.
