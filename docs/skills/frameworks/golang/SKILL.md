---
name: golang
description: Use when writing or changing Go code - packages, modules, services, HTTP handlers, or concurrent work. Covers module layout including what internal/ actually enforces versus the cmd/ community convention, package naming and boundaries, error handling with wrapping and sentinel errors, context propagation and cancellation, goroutine lifetime and leak prevention, channel and mutex selection, small consumer-defined interfaces, struct and slice gotchas, structured logging, and table-driven tests with the race detector. Triggers on go.mod, any .go file, or mentions of goroutines, channels, context, defer, or interfaces. Go is a language rather than a framework, but the conventions are ecosystem-specific enough to warrant their own skill.
compatibility: For Go modules. Verify version-specific standard library APIs against the go directive in go.mod and the documentation for that release.
metadata:
  category: framework
  version: "1.0.0"
---

# Go

> **Rule strength:** MUST / NEVER are mandatory. SHOULD is the default — deviate only with a stated reason. CONSIDER is a judgment call.

## Version context

Verified against Go 1.26.x as of 2026-08-11.

**MUST** read the `go` directive in `go.mod` before using a standard library API or language feature. It sets the language version, and a newer API will not compile against an older directive. Generics, `errors.Join`, `log/slog`, and range-over-function iterators each have a minimum version.

## Detect before writing

- `go.mod` — module path, `go` directive, dependencies.
- The existing layout: single package at the root, packages by domain, or `cmd/` plus `internal/`.
- Whether the project uses the standard library router and logger or third-party ones.
- Two or three existing packages near your change, and how they handle errors and context.
- `Makefile` or CI config for the authoritative build, lint, and test commands.

## Module layout

Official guidance, with the distinction between what is enforced and what is convention:

| Directory | Status | Meaning |
|---|---|---|
| Root package | Official | A small library keeps its code at the root |
| `internal/` | **Compiler-enforced** | Other modules cannot import it. This is a real boundary, not a naming hint |
| `cmd/<name>/` | **Community convention** | Official docs describe it as "a common convention", useful in a mixed repository of packages and commands |
| Domain packages (`auth/`, `store/`) | Official | Importable packages, one directory per package |

- **SHOULD** put everything not intended as a public API in `internal/`. For a server, that is usually almost everything, with thin `main` packages under `cmd/`.
- **NEVER** import an internal-looking package across a module boundary and expect it to work — the compiler rejects it.
- **NEVER** create the elaborate multi-directory scaffolding of the popular community layout template in a project that does not need it. It is not official guidance. Start with the root package or a handful of domain packages and grow.
- One package per directory. The directory name is the package name.

## Packages and naming

- Package names are **short, lowercase, single words, no underscores, no plurals**: `store`, `auth`, `httpapi`.
- The package name is part of every call site, so **NEVER** stutter: `http.Server`, not `http.HTTPServer`; `store.New`, not `store.NewStore`.
- **NEVER** name a package `util`, `helpers`, `common`, `base`, or `misc`. The name says nothing, so anything lands there. Name it for what it provides. See the `project-structure` skill.
- Exported identifiers are `MixedCaps`, unexported are `mixedCaps`. **Never** underscores. Acronyms keep consistent case: `ServeHTTP`, `userID`, `parseURL`.
- Getters omit `Get`: `u.Name()`, not `u.GetName()`.
- File names are `lowercase_with_underscores.go`; tests are `<file>_test.go`.

## Errors

- **MUST** handle every returned error, or explicitly discard it with `_` and a comment saying why. **NEVER** ignore an error silently.
- Return errors; do not panic. Reserve `panic` for genuinely impossible states and programmer errors, and never let one cross a package boundary as an error-signalling mechanism.
- **Wrap with `%w` to preserve the chain**, and add the context the caller lacks:

  ```go
  if err != nil {
      return fmt.Errorf("load order %s: %w", id, err)
  }
  ```

- **NEVER** use `%v` for an error you want callers to inspect — it flattens the error to text and breaks `errors.Is` and `errors.As`.
- Message convention: lowercase, no trailing punctuation, no "failed to" prefix. Wrapping composes messages, so each layer adds only its own noun.
- Inspect with `errors.Is` for sentinel values and `errors.As` for typed errors. **NEVER** compare error strings.
- Define sentinel errors (`var ErrNotFound = errors.New("not found")`) for conditions callers must branch on, and a custom error type when the caller needs structured detail.
- Use `errors.Join` to combine independent failures rather than returning only the first.
- **NEVER** return both a non-nil result and a non-nil error and expect the caller to guess. Document which is valid.

## Context

- **MUST** accept `ctx context.Context` as the **first parameter** of any function that performs I/O, blocks, or calls something that does.
- **MUST** propagate the incoming context rather than creating a new one. **NEVER** pass `context.Background()` or `context.TODO()` from inside a request path — it discards cancellation and deadlines, so work continues after the client is gone.
- **MUST** set a timeout on outbound calls, and `defer cancel()` immediately after creating a cancellable context. A missed `cancel` leaks the context and its timer.
- Check `ctx.Err()` or select on `ctx.Done()` inside long loops so cancellation actually takes effect.
- **NEVER** store a context in a struct field. Pass it through the call chain.
- Context values are for request-scoped data crossing API boundaries (correlation id, authenticated principal), with typed unexported keys. **NEVER** use them to pass ordinary parameters.

## Concurrency

Goroutines are cheap to start and easy to leak. The rules below prevent the two defects that matter.

- **MUST know how every goroutine ends.** A goroutine blocked forever on a channel send or receive is a leak that grows until the process dies. Give every goroutine a termination condition: a closed channel, a cancelled context, or a bounded task.
- **NEVER start a goroutine without a way to wait for it** where the caller depends on its result or its cleanup. Use a `sync.WaitGroup` or an error-group abstraction.
- **NEVER** ignore an error from a goroutine. A bare `go doWork()` discards whatever it returns.
- **MUST** capture loop variables correctly for the language version in `go.mod`. Per-iteration loop variable semantics changed in Go 1.22; below that directive, a goroutine closing over the loop variable sees the final value.
- Bound concurrency. Unlimited goroutines fanning out to a database or an API exhaust connections and downstream rate limits. Use a semaphore or a worker pool. See the `performance` skill.
- **Choose the primitive by intent**: channels to transfer ownership of data and to signal; a `sync.Mutex` to protect shared state in place. Do not build a queue out of mutexes or protect a counter with a channel.
- Keep critical sections small, and **NEVER** perform I/O while holding a lock.
- `defer mu.Unlock()` immediately after `mu.Lock()`.
- **MUST** run tests with `-race` on any code with concurrency. It finds data races that no amount of reading will.
- Prefer immutable data passed by value over shared mutable state guarded by a lock.

## Interfaces

- **Define interfaces where they are consumed, not where they are implemented.** The consumer knows the minimum it needs; the implementer does not.
- **Keep them small** — one or two methods. A large interface forces every implementation and every test double to satisfy methods nobody calls.
- **NEVER** create an interface with exactly one implementation "for testability" before a second implementation or a real test need exists. Accept the concrete type and change it when the need appears.
- Accept interfaces, return concrete types. Returning an interface hides the real capabilities from callers.
- **NEVER** prefix interfaces with `I`. Single-method interfaces conventionally end in `-er`: `Reader`, `Storer`, `Notifier`.

## Common traps

These cause real, silent defects:

- **Nil interface versus nil pointer.** An interface holding a nil pointer is **not** nil. Returning a typed nil error value makes `err != nil` true.
- **Slice aliasing.** `append` may reuse the backing array, so a subslice can mutate its parent. Copy explicitly when you need independence, and be aware `s[a:b]` shares memory.
- **Map iteration order is randomized.** **NEVER** depend on it; sort keys when order matters.
- **Maps are not safe for concurrent use.** A concurrent read and write panics. Guard with a mutex or use the concurrent map type.
- **`defer` arguments evaluate immediately**, but the call runs at function exit. A `defer` inside a loop accumulates until the function returns — move it into its own function.
- **Struct comparison** works only when every field is comparable; slices, maps, and functions are not.
- **Zero values are usable** for many standard types — a zero `sync.Mutex` and a nil slice are ready to use. Do not write constructors that only set zero values.
- **`time.Time` should be compared with `Equal`**, not `==`, because of monotonic-clock and location fields.

## Logging and observability

- Use structured logging with key-value attributes rather than formatted strings, so logs are searchable. The standard library provides `log/slog` on recent versions; otherwise follow the project's logger.
- Pass the logger explicitly or attach it to the context at the request boundary. **NEVER** log to a package-level global from a library package.
- **NEVER** log credentials, tokens, or personal data. See the `security` skill.
- Attach a correlation id at the entry point and propagate it. See the `backend-engineering` skill.

## Testing

- **Table-driven tests are the idiom.** One test function, a slice of named cases, a subtest per case. Name cases so a failure identifies itself.
- Use `t.Helper()` in assertion helpers so failures report the caller's line.
- Use `t.Cleanup` rather than manual teardown, and `t.TempDir` for filesystem tests.
- **MUST** run `go test -race ./...` for concurrent code.
- Prefer the standard library and small assertion helpers over a heavy assertion framework, unless the project already uses one.
- Test exported behavior from the package under test. Use an external test package (`package foo_test`) when you want to verify the public surface.
- Check errors with `errors.Is`/`errors.As`, never by string comparison.

## Validation gates

```
gofmt -l .            (or: test -z "$(gofmt -l .)")
go vet ./...
golangci-lint run     if configured
go build ./...
go test -race ./...
```

`gofmt` is not negotiable in Go — formatting is settled, not a preference. Confirm the project's exact commands from its `Makefile` or CI.

## Anti-patterns

| Anti-pattern | Correct approach |
|---|---|
| Ignoring a returned error | Handle it, or `_` with a comment |
| `%v` for a wrapped error | `%w`, so `errors.Is`/`errors.As` work |
| Comparing error strings | `errors.Is` / `errors.As` |
| `panic` for an expected failure | Return an error |
| `context.Background()` inside a request path | Propagate the incoming context |
| Context stored in a struct field | Pass it as the first parameter |
| Cancellable context without `defer cancel()` | Always defer the cancel |
| Outbound call with no timeout | Set one |
| `go doWork()` with no termination condition | Know how it ends; wait for it |
| Error from a goroutine discarded | Collect it |
| Unbounded goroutine fan-out | Semaphore or worker pool |
| Channel used to protect a counter | `sync.Mutex` or an atomic |
| I/O while holding a lock | Release first |
| Interface defined at the implementation | Define it at the consumer |
| One-method interface with one implementation, added preemptively | Use the concrete type |
| `IStore`-style naming, or `store.NewStore` | `Storer` / `store.New` |
| Package named `util` or `common` | Name it for what it provides |
| `GetName()` accessor | `Name()` |
| Depending on map iteration order | Sort the keys |
| `defer` inside a long loop | Extract a function |
| Concurrent code tested without `-race` | Always use `-race` |
| Full community layout scaffolding in a small project | Root package or a few domain packages |

## Related skills

- `naming-conventions` — Go naming in the ecosystem reference.
- `backend-engineering` — services, timeouts, retries, observability.
- `performance` — bounding concurrency and measuring cost.
- `data-structures` — slice and map cost and aliasing.
- `testing` — table-driven tests and substitution.
