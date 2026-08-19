---
name: data-structures
description: Use when choosing how to hold or index data in memory, or when existing code repeatedly scans a collection. Covers selecting between array or list, hash map, set, ordered map, queue, stack, heap, tree, and graph based on the operations the workload actually performs, the cost of lookup, insertion, deletion, iteration, ordering, memory, and serialization, and when a database index or cache is the right structure instead of an in-memory one. Triggers on "which data structure", a nested loop over two collections, a repeated linear search, deduplication, grouping or aggregating, maintaining sorted or top-N results, queue and worker processing, or modelling relationships and hierarchies. Rejects sophisticated structures adopted without a workload reason.
metadata:
  category: foundation
  version: "1.0.0"
---

# Data Structures

> **Rule strength:** MUST / NEVER are mandatory. SHOULD is the default — deviate only with a stated reason. CONSIDER is a judgment call.

Choose the structure from the operations the code performs, not from familiarity or sophistication.

## Choose from the workload

**MUST** answer before selecting: what operations run, how often, and on what size?

1. **What is the dominant operation?** Lookup by key, membership test, ordered iteration, insertion at an end, finding the extreme, or full scan.
2. **How large can it get?** Below roughly a hundred elements, a plain array wins on almost every operation because of memory locality and zero overhead. Optimize for growth only where growth is real.
3. **Does order matter?** Insertion order, sorted order, or no order.
4. **Does it need to be serialized, cached, or sent over a boundary?** That constrains you to structures the format supports.

The single most valuable rule: **replace a repeated linear search with a hash-based lookup built once.**

```
Nested loop over two collections     O(n × m)
Build a map from one, then loop      O(n + m)
```

This is the fix for the most common accidental quadratic cost in application code.

## Selection table

Approximate average-case costs. Names differ per language; the semantics do not.

| Need | Structure | Lookup | Insert | Ordered | Notes |
|---|---|---|---|---|---|
| Indexed sequence, iteration | Array / list / vector | O(n) by value, O(1) by index | O(1) at end | Insertion | Best locality; the default |
| Lookup by key | Hash map / dictionary / object | O(1) | O(1) | No guarantee | The workhorse |
| Membership, deduplication | Set | O(1) | O(1) | No guarantee | Use instead of `contains` on an array |
| Key lookup **and** sorted iteration | Ordered / sorted map, B-tree map | O(log n) | O(log n) | Sorted by key | Only when you need the ordering |
| FIFO processing | Queue / deque | — | O(1) both ends | FIFO | **Never** shift from the front of an array in a loop |
| LIFO processing | Stack | — | O(1) | LIFO | Also the iterative replacement for recursion |
| Repeatedly get smallest or largest | Heap / priority queue | O(1) peek | O(log n) | Partial | Top-N without sorting everything |
| Prefix or range queries | Trie, sorted structure | varies | varies | Sorted | Only for real prefix workloads |
| Relationships, dependencies | Graph (adjacency map) | O(1) per node | O(1) | — | Adjacency map beats a matrix unless dense |
| Hierarchy | Tree, or parent pointers | varies | varies | — | Flat list plus `parent_id` is often simpler |
| Bounded most-recently-used cache | LRU / size-bounded map | O(1) | O(1) | Access | Requires an eviction policy |

## Decision rules

- **Membership test → set, never an array.** `array.includes(x)` inside a loop is a linear scan per iteration. This is the most common avoidable quadratic in real code.
- **Grouping or counting → map keyed by the grouping value.** One pass, not one pass per group.
- **Joining two collections → map one by its key, then iterate the other.**
- **Top-N of a large collection → heap of size N**, not a full sort. Sorting to take 10 of a million is `O(n log n)` for an `O(n log N)` job.
- **Need insertion at both ends → deque.** Removing from the front of an array is `O(n)` in most languages because every element shifts.
- **Need sorted output once, at the end → collect then sort.** Do not maintain sorted order on every insert unless you read the ordering between inserts.
- **Composite keys** — use the language's tuple or record key if it supports value equality; otherwise use a nested map or a deliberately constructed string key with a separator that cannot appear in the parts.

## Cost dimensions to weigh

Lookup speed is one of six costs. Consider the others before choosing:

| Cost | Ask |
|---|---|
| Time per operation | Which operation runs most often? |
| Memory overhead | Hash maps and node-based structures carry significant per-entry overhead versus a packed array |
| Locality | Contiguous arrays are dramatically faster to scan than pointer-chasing structures, at the same complexity |
| Mutation semantics | Is it shared? Does it need to be immutable, copy-on-write, or thread-safe? |
| Serialization | Sets, maps with non-string keys, and cyclic graphs do not round-trip through JSON without conversion |
| Readability | A structure a reader must reason about costs every future maintainer |

## Language-specific traps

Check these against the ecosystem you are in — they cause real, silent defects:

- **Key coercion.** Some languages coerce object keys to strings, so distinct objects collide and numbers become strings. Use the language's real map type when keys are not strings.
- **Reference versus value equality.** Most hash maps and sets key on identity for objects. Two structurally identical objects will be two entries. Key on a primitive you derive, or use a structure that supports value equality.
- **Ordering guarantees.** Some hash maps guarantee insertion order, others do not. Never rely on iteration order unless the language guarantees it.
- **Removing while iterating** is undefined or throws in most languages. Collect the keys to remove, then remove them.
- **Shallow copy.** Copying a collection usually copies references, not the elements. Mutating an element mutates it in both.
- **Sorting mutability.** Some sort methods mutate in place; some return a new collection. Mutating a shared array in a sort is a common source of surprising bugs.

## When the structure belongs elsewhere

Not every indexing problem is an in-memory one. **MUST** consider these before building a structure:

- **Loading a table into memory to search it → use a database index.** The database already has the right structure and it does not have to fit in your process. See the `database` skill.
- **Sharing state between processes or instances → use a shared store.** An in-memory map is per-instance; it silently breaks correctness as soon as there is more than one instance. See the `backend-engineering` skill.
- **Work handed between processes → use a queue,** not an in-memory list.
- **Data that must outlive the process → persist it.**

## Keep it proportional

- **NEVER** introduce a trie, bloom filter, skip list, segment tree, or custom balanced tree without a measured workload that needs it. Use the language's standard structures.
- Prefer the standard library's implementation over a hand-written one. It is tested, optimized, and understood by everyone reading the code.
- Do not add a dependency for a structure the standard library already provides. See `dependency-management`.
- A clear structure that is slightly slower beats a clever one nobody can modify safely — unless a measurement says otherwise. See the `performance` skill.

## Anti-patterns

| Anti-pattern | Correct approach |
|---|---|
| `includes` / `indexOf` / `contains` inside a loop | Build a set once |
| Nested loops to correlate two collections | Map one by key, iterate the other |
| Removing from the front of an array in a loop | Use a deque, or iterate in reverse |
| Sorting a large collection to take the first few | Heap of size N |
| Maintaining sorted order on every insert, read once | Collect, then sort |
| Loading a whole table to filter in application code | Filter in the query, with an index |
| An in-memory map used as a cache across instances | A shared store with eviction |
| A hand-rolled exotic structure with no benchmark | Standard library structure |
| Object used as a map with non-string keys | The language's real map type |
| Relying on hash iteration order | Sort explicitly, or use an ordered structure |

## Related skills

- `performance` — measuring whether the structure is actually the bottleneck.
- `database` — indexes as the persistent equivalent of these structures.
- `backend-engineering` — shared state, queues, and per-instance memory.
- `clean-code` — keeping the choice readable.
