---
name: code-review
description: Use when reviewing a code change - your own before reporting it complete, or someone else's diff, pull request, or branch. Provides a review pass over correctness, architectural fit, maintainability, security, performance, test coverage, scope creep, and regression risk, plus how to report findings by severity. Triggers on "review this", "review my changes", "check this PR", "is this ready to merge", "what's wrong with this diff", or finishing an implementation before reporting. Requires reading the actual diff rather than recalling what was intended. Not for finding the cause of a known failure - use debugging for that.
metadata:
  category: process
  version: "1.0.0"
---

# Code Review

> **Rule strength:** MUST / NEVER are mandatory. SHOULD is the default — deviate only with a stated reason. CONSIDER is a judgment call.

## Read the actual diff

**MUST** start here, including when reviewing your own work.

```
git status                  # untracked and unintended files
git diff                    # unstaged changes
git diff --staged           # staged changes
git diff <base>...HEAD      # everything on the branch
git diff --stat <base>...HEAD   # shape and size of the change
```

Reviewing from memory of what you meant to do is how debug statements, stray edits, secrets, and half-finished code survive to completion. The diff is the only source of truth.

Then read the changed code **in its file**, with surrounding context. A diff hunk hides the caller, the sibling branch, and the invariant three lines above.

## Review dimensions

Work through all eight. Note findings as you go; judge severity at the end.

### 1. Correctness

- Does it actually satisfy the stated requirement — all of it, not the easy part?
- Trace the main path with concrete values. Then trace: empty, null/absent, zero, negative, maximum, duplicate, and unauthorized.
- Are error paths handled, or only the happy path?
- Are async operations awaited? Are promises and errors propagated rather than dropped?
- Do conditions have off-by-one or inverted-logic mistakes? Check every boundary comparison.
- Are there ordering or concurrency assumptions that are not enforced?

### 2. Architectural fit

- Does it sit in the layer that owns this responsibility, or is business logic leaking into a controller, UI, or data-access file?
- Do new dependencies point in the allowed direction? Any new cycle?
- Does it reuse existing abstractions, or reimplement something the codebase already has?
- Does it introduce an abstraction with only one use site?
- Are new files placed consistently with their neighbors?

See `architecture` and `project-structure`.

### 3. Maintainability

- Will a developer unfamiliar with this change understand it in six months?
- Do names follow the ecosystem's convention and the repository's existing pattern? Is any file named in another language's style?
- Is control flow readable, or deeply nested?
- Are non-obvious decisions explained by a comment that gives the reason?
- Does it match the surrounding style, or import a foreign one?
- Does a comment contradict the code it describes?

See `clean-code` and `naming-conventions`.

### 4. Security

- Any secret, key, token, password, or credential in code, config, tests, fixtures, examples, or logs?
- Is untrusted input validated at the boundary? Is output encoded for its destination?
- Are queries parameterized? Any string-built SQL, shell command, or file path from user input?
- Is authorization enforced on every new or changed access path — not just authentication?
- Does the change log sensitive data, or return internal detail in an error response?
- Was any existing validation, permission check, or security control removed or weakened?

See `security`.

### 5. Performance

- Any I/O inside a loop (N+1)? Any unbounded result set or missing pagination?
- Are new queries supported by an index? Do they scan a whole table?
- Any nested iteration over two collections where a keyed lookup would do?
- Independent async calls awaited in sequence rather than concurrently?
- Repeated expensive work that could be computed once?
- Blocking I/O on a latency-sensitive path? Unbounded memory or cache growth?

Flag work that is **algorithmically** or **structurally** wasteful. Do not raise micro-optimizations without evidence — speculative performance changes are their own defect. See `performance` and `data-structures`.

### 6. Tests

- Is the new behavior covered where it matters, at the right level?
- Does a bug fix have a regression test that would fail without the fix?
- Do the assertions check the actual outcome, or merely that something truthy happened?
- Are edge cases and failure paths covered, not just the success path?
- Were any tests deleted, skipped, or weakened? **That is always a finding.**
- Are the tests deterministic and independent?

See `testing`.

### 7. Scope

- Does every changed file relate to the stated task?
- Any unrelated refactoring, renaming, or reformatting mixed in?
- Any new dependency, and is it justified? See `dependency-management`.
- Any framework, build tool, or data store swapped without approval?
- Leftovers: debug output, commented-out code, scratch files, unintended TODOs, generated artifacts, `.env` files.

### 8. Regression risk

- Who else calls the changed function? Check every caller — do not assume.
- Did a signature, return shape, error type, or default value change? Are all callers updated?
- Does it change a public contract, API response, event payload, or persisted data shape? Is that a breaking change for existing consumers or stored data?
- Does it change a shared component's behavior for existing users of that component?
- Does a migration preserve existing data? See `database`.
- Is a feature flag, config key, or environment variable required for this to work in other environments?

## Reporting findings

Classify by severity so the reader knows what blocks:

| Severity | Meaning | Examples |
|---|---|---|
| **Blocking** | Must be fixed before this ships | Wrong behavior, security hole, data loss, exposed secret, deleted test, broken contract |
| **Should fix** | Real problem; fix now or track explicitly | Missing error handling, absent coverage of a risky path, N+1 query, architectural violation |
| **Consider** | Genuine improvement, author's call | Naming, structure, simplification |

For each finding, give: **the file and line, what is wrong, and the concrete consequence.** A finding without a consequence is a preference.

Rules for the review itself:

- **NEVER** report a problem you have not verified against the actual code. State uncertainty as uncertainty.
- Prefer few high-confidence findings over many speculative ones. Volume degrades the signal.
- Do not restate what the change does; the author knows.
- Do not raise style points the project's own formatter or linter already governs.
- Say plainly when the change is sound. "No blocking issues" is a valid and useful result.
- Reviewing does not mean rewriting. Do not apply fixes unless asked.

## Related skills

- `agentic-development` — the Definition of Done checklist this review feeds.
- `security`, `testing`, `database`, `api-design`, `performance` — depth on individual dimensions.
- `naming-conventions` — whether a name is right for its ecosystem.
- `frameworks/*` — framework-specific defects a generic review misses.
- `git-workflow` — inspecting the diff safely.
