---
name: testing
description: Use when writing, updating, or deciding whether to write tests, and when choosing between unit, integration, and end-to-end coverage. Covers discovering a project's existing test strategy before adding to it, what deserves a test, meaningful assertions, edge cases and failure paths, test isolation and determinism, avoiding brittle tests that assert implementation details, flaky test handling, and test data setup. Triggers on "add tests", "write a test for", "is this tested", a failing or flaky test, a bug fix that needs regression coverage, or a request to raise coverage. Also use before introducing any new test framework, runner, assertion library, or mocking library. Not for diagnosing why code is broken - use debugging for that.
metadata:
  category: process
  version: "1.0.0"
---

# Testing

> **Rule strength:** MUST / NEVER are mandatory. SHOULD is the default — deviate only with a stated reason. CONSIDER is a judgment call.

## First: find the existing strategy

**MUST** do this before writing a single test.

1. Locate the tests: `test/`, `tests/`, `spec/`, `__tests__/`, or files alongside source.
2. Identify the runner and assertion style from the package manifest and CI config.
3. Read two or three existing tests near your change. Copy their structure, naming, setup, and assertion style.
4. Find the helpers that already exist — factories, fixtures, builders, test database setup, custom matchers, authenticated-request helpers. Reuse them.
5. Note how the project handles external systems: real, in-memory, containerized, faked, or mocked.

**NEVER** introduce a new test framework, runner, assertion library, or mocking library into a project that already has one. If the existing setup genuinely cannot express the test, say so and ask.

If there are no tests at all, that is a decision point, not an invitation. Match the language's conventional tooling, keep the setup minimal, and say what you added.

## What to test

Write tests for behavior that would be **expensive to get wrong** and **stable enough to be worth pinning**.

| Priority | What |
|---|---|
| Always | Business rules, calculations, state transitions, validation and permission logic |
| Always | Every bug you fix — as a regression test |
| Usually | Boundaries between components: API contracts, data access, integrations |
| Usually | Error and failure paths, not just the success path |
| Rarely | Trivial getters, direct pass-throughs, framework behavior, third-party library behavior |
| Never | Tests written only to move a coverage number |

**NEVER** write tests purely to increase coverage. Coverage measures which lines ran, not whether behavior is correct. A test with no meaningful assertion is worse than no test — it produces a false signal and must still be maintained.

Cover, for each unit of behavior: the normal case, the boundaries (empty, zero, one, maximum, off-by-one), the invalid input, the failure path (dependency errors, timeouts, rejections), and any concurrency or ordering assumption the code makes.

## Choosing the level

| Level | Scope | Use for |
|---|---|---|
| **Unit** | One function or module, dependencies substituted | Business rules, algorithms, pure logic, edge cases |
| **Integration** | Several real components together (often a real database) | Data access, transactions, wiring, contracts between layers |
| **End-to-end** | The running system through its real entry point | A few critical user journeys only |

Default to the **lowest level that can actually observe the behavior**. A rule expressible as a unit test SHOULD be a unit test — it is faster, more precise, and fails with a clearer message.

E2E tests are slow, flaky, and expensive to maintain. Keep them few and reserved for paths where failure is unacceptable (sign-in, checkout, the core workflow).

## Writing the test

- **Name it after the behavior**, including the condition and the expectation: `rejects transfer when balance is insufficient`. A name like `test1` or `testUserService` tells a future reader nothing when it fails.
- **One behavior per test.** A test that asserts five unrelated things reports only the first failure.
- **Arrange, act, assert** — visibly separated, even without comments.
- **Assert the specific outcome.** `expect(result).toBeTruthy()` passes for almost anything. Assert the value, the error type, the message, the record that was written.
- **Set up only what the test needs.** A test that constructs an unrelated ten-field object hides which field actually matters.
- **Prefer real objects over mocks** where cheap. Mock what is slow, non-deterministic, external, or has side effects you must not cause.

## Test independence and determinism

**MUST** hold for every test:

- Passes alone, passes in the suite, passes in any order. No test depends on another having run.
- Leaves no state behind — database rows, files, environment variables, global registries, module-level caches, fake timers. Clean up in teardown, not in the next test's setup.
- No dependence on wall-clock time, real timezones, locale, randomness, network availability, or machine specifics. Inject the clock and the random source; pin the seed and the timezone.
- No arbitrary sleeps to wait for async work. Await the actual signal, or use the framework's waiting primitive.

## Not testing implementation details

A test SHOULD survive a refactor that preserves behavior. If renaming a private method or reordering internal calls breaks the test, the test is coupled to implementation.

- Assert on **outputs and observable effects** — return values, thrown errors, persisted records, messages sent, rendered output.
- **NEVER** assert on private methods, internal call counts and orderings that the contract does not promise, or exact log strings that are not part of the contract.
- Test through the public surface a real caller would use.
- In UI tests, query by what a user perceives (role, label, visible text), not by internal class names or component structure. See the `frontend-engineering` skill.

The exception: when an interaction *is* the contract ("charges the payment provider exactly once"), asserting it is correct.

## When a test fails

- **A failing test is information.** Diagnose it with the `debugging` skill.
- **NEVER** delete, skip, comment out, or weaken a test to make a suite green. If a test is genuinely wrong, fix it and say in the report that you changed a test and why.
- Fix the code when the test is right; fix the test only when the specification actually changed.

**Flaky tests:** find the source of the nondeterminism — shared state, timing, ordering, real network, unseeded randomness — and remove it. A retry wrapper hides the flake without fixing it and MUST NOT be added without saying so explicitly.

## Bug fixes

**MUST** follow this order:

1. Write a test that reproduces the bug and **watch it fail** — a test that passes before the fix proves nothing.
2. Apply the smallest fix.
3. Watch the test pass, and run the rest of the suite.

## Related skills

- `debugging` — diagnosing the failure a test surfaced.
- `code-review` — judging whether a change's coverage is adequate.
- `database` — test data and transactional isolation for integration tests.
- `frameworks/*` — the test tooling and conventions each framework ships.
- `agentic-development` — running the suite as a validation gate before reporting.
