---
name: debugging
description: Use when something is broken and the cause is not yet known - a failing test, an exception, a crash, wrong output, a regression, a performance problem, or behavior that differs between environments. Enforces an evidence-driven loop - observe, reproduce, gather evidence, form and test a hypothesis, apply the smallest fix, add regression coverage, verify - instead of guessing at changes. Triggers on "this is broken", "why is this failing", "it works locally but not in CI", "the test is failing", an error message or stack trace, or an unexplained behavior difference. Also use when a first attempted fix did not work, to prevent trial-and-error editing and error suppression.
metadata:
  category: process
  version: "1.0.0"
---

# Debugging

> **Rule strength:** MUST / NEVER are mandatory. SHOULD is the default — deviate only with a stated reason. CONSIDER is a judgment call.

```
Observe → Reproduce → Collect evidence → Hypothesize → Test the hypothesis
   → Smallest fix → Regression test → Verify
```

**MUST NOT** change code before reaching the hypothesis step. Editing code to see what happens destroys the evidence, introduces new variables, and frequently "fixes" the symptom while leaving the cause in place.

## 1. Observe

Write down precisely, without interpretation:

- What was expected, and what actually happened.
- The **exact** error message and full stack trace — not a paraphrase.
- Where it occurs: environment, entry point, input, user, data.
- Whether it is deterministic or intermittent.
- When it started, and what changed around then.

Read the whole stack trace, including wrapped causes. The first line names the symptom; the frames name the path; the innermost cause usually names the problem.

## 2. Reproduce

**MUST** reproduce before diagnosing. Without reproduction you cannot tell a fix from a coincidence.

Reduce to the smallest reliable reproduction — the minimum input, state, and steps that still trigger it. Every element you remove is a hypothesis eliminated.

If it cannot be reproduced locally: reproduce in the environment where it happens, or add temporary instrumentation to capture the state at failure. Say explicitly that reproduction was not achieved rather than proceeding as if it had been.

**Intermittent failures** point to a small set of causes — shared mutable state, ordering or timing, concurrency, uncleaned state between runs, real network or clock dependence, unseeded randomness, resource exhaustion. Check those before anything else.

## 3. Collect evidence

Gather facts before forming an explanation:

- **Read the failing code path** end to end, including the callers. Do not assume it does what its name says.
- **Check what changed** — recent commits touching the path, dependency or version changes, configuration or environment differences, data changes.
- **Inspect actual runtime values** at the boundaries: what went in, what came out, what the intermediate state was. A logged value beats an assumed one.
- **Compare working versus broken** — a passing input against a failing one, one environment against another. The difference is the lead.

For environment-specific failures, compare systematically: versions, environment variables, configuration, credentials, filesystem layout, locale and timezone, network access, resource limits, and whether the build is dev or production.

## 4. Hypothesize

State the hypothesis as a falsifiable sentence: *"X fails because Y, which I can confirm by observing Z."*

List the plausible causes and order them by prior probability. In practice, most defects are:

- Wrong assumption about input shape, nullability, or type
- Off-by-one, boundary, or empty-collection handling
- State not reset between operations or runs
- Async: unawaited work, ordering, race, unhandled rejection
- Configuration or environment difference
- Error swallowed upstream, hiding the real failure
- Wrong version of a dependency, or a stale build/cache
- A recent change with an unintended side effect

**NEVER** stop at the first plausible-sounding explanation without testing it. Plausible and correct are different.

## 5. Test the hypothesis

Confirm before fixing — with a log line, a breakpoint, an assertion, a targeted test, or a minimal script that isolates the suspected behavior.

If the evidence contradicts the hypothesis, discard it and return to step 4. Do not fix a cause you have not confirmed.

**Bisecting** is the reliable tool when the hypothesis space is large: find a known-good state, find a known-bad one, and halve the difference — by commit, by input, by configuration, or by disabling half the code path.

## 6. Apply the smallest fix

- Fix the **cause**, not the symptom. A null check that hides why the value was null leaves the defect in place and makes the next failure harder to find.
- Change the minimum that resolves the confirmed cause.
- **NEVER** fix by suppression: no catching and ignoring, no returning a default to skip the failure, no removing an assertion, no type escape hatch, no lint or test suppression.
- If the correct fix is out of scope, say so precisely and describe it. Do not apply a workaround silently.
- Ask whether the same defect exists elsewhere in the codebase, and report it if so.

## 7. Add regression coverage

**MUST**, for any non-trivial bug: write a test that fails before the fix and passes after. Confirm it fails against the unfixed code — a test that never failed proves nothing about the bug. See the `testing` skill.

## 8. Verify

- The original reproduction no longer reproduces.
- The full test suite passes.
- Nearby behavior that shares the code path still works.
- Any temporary instrumentation — debug logs, print statements, breakpoints, scratch files, commented-out code — has been removed.

Then report the **cause**, not just the fix. "Added a guard" is not a diagnosis; "the cache key omitted the tenant id, so requests from one tenant returned another's rows" is.

## When stuck

After two or three failed hypotheses, stop and change approach:

- Re-read the error message literally. It usually says what happened.
- Question an assumption you have not verified — that the code deployed is the code you are reading, that the config loaded is the file you opened, that the test is exercising the path you think.
- Verify the build is fresh and caches are clear.
- Reduce further: strip the reproduction until it is trivial.
- Explain the problem step by step from the top; the contradiction usually surfaces.

**NEVER** respond to being stuck by making speculative changes and re-running. If you genuinely cannot determine the cause, report what you established, what you ruled out, and what you would need to proceed.

## Related skills

- `testing` — writing the regression test and fixing flaky tests.
- `code-review` — checking the fix for scope and regression risk.
- `agentic-development` — the surrounding validate-and-report loop.
