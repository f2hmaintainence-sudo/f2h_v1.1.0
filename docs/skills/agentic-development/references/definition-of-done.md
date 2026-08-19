# Definition of Done

Work through this before reporting a change as complete. Items marked N/A are fine — silently skipping them is not.

## Correctness

- [ ] The requirement is understood and restated as observable behavior.
- [ ] The implemented behavior actually satisfies that requirement.
- [ ] The final behavior was verified by running something, not by reading the code.
- [ ] Edge cases and failure paths behave sensibly (empty, null/absent, zero, boundary, duplicate, concurrent, unauthorized).

## Fit with the codebase

- [ ] Existing code was inspected before adding anything new.
- [ ] The existing architecture and layer boundaries are respected.
- [ ] Existing abstractions, helpers, and error types were reused rather than duplicated.
- [ ] The change lives in the correct files; no new file or directory was created that an existing one could have held.
- [ ] Naming, structure, and idiom match the surrounding code.

## Scope

- [ ] No unrelated code was refactored, reformatted, or renamed.
- [ ] No unrelated files appear in the diff.
- [ ] No dependency was added without justification and without checking existing dependencies first.
- [ ] No framework, build tool, or data store was swapped without explicit approval.

## Quality

- [ ] Types are accurate; no escape hatch (`any`, unchecked cast, ignore comment) was used to silence a real type error.
- [ ] Errors are handled at a level that can act on them; none are silently swallowed.
- [ ] No debug output, commented-out code, scratch files, or TODOs left behind unintentionally.
- [ ] No magic values introduced without a name or an explanation.

## Security

- [ ] No secret, token, key, password, or credential appears in source, config, logs, examples, tests, or fixtures.
- [ ] Untrusted input crossing a boundary is validated.
- [ ] Authorization is enforced on any new or changed access path.
- [ ] No existing security control was removed, weakened, or bypassed.

## Tests

- [ ] Tests were added or updated where the change warrants them, following the project's existing testing approach.
- [ ] A bug fix has a regression test that fails without the fix.
- [ ] No test was deleted, skipped, or weakened to make the suite pass.
- [ ] The existing test suite passes, and you ran it.

## Gates

- [ ] Formatter passes.
- [ ] Linter passes, with no new suppressions added without understanding the rule.
- [ ] Type check passes.
- [ ] Build passes, if the project builds.
- [ ] Any check that could not be run is reported as not run.

## Handover

- [ ] `git status` and `git diff` reviewed in full.
- [ ] Documentation updated where the change invalidated it.
- [ ] The report states what was verified, how, and what was not.
