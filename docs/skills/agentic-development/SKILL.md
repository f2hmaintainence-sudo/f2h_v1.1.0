---
name: agentic-development
description: Use when starting, executing, or finishing any coding task in an existing repository. Defines the end-to-end working loop for a coding agent - investigate before changing, plan, make the smallest correct change, validate with the project's own tooling, self-review the diff, and report honestly. Triggers on "implement", "add a feature", "fix this bug", "refactor", "make this change", or any request that will modify source code. Also use when validation fails, when a requirement is ambiguous, when deciding whether to ask the user before proceeding, or when unsure which other engineering skill applies. This is the entry-point skill and routes to the architecture, project-structure, clean-code, testing, code-review, and git-workflow skills at the right moment.
metadata:
  category: workflow
  version: "1.0.0"
---

# Agentic Development

> **Rule strength:** MUST / NEVER are mandatory. SHOULD is the default — deviate only with a stated reason. CONSIDER is a judgment call.

The working loop for changing code you did not write.

```
Understand → Inspect → Search → Plan → Implement → Validate → Review → Report
```

Never skip Inspect. Never skip Search. Never skip Validate. Everything else scales with the size of the change.

## 1. Understand

State the requirement back to yourself in one sentence before touching anything: *what observable behavior must be true when this is done?*

If you cannot write that sentence, you are missing information — see [Handling ambiguity](#handling-ambiguity).

## 2. Inspect

**MUST** complete before writing code. Never assume the repository is empty, greenfield, or conventional.

| Look for | Why it decides your next move |
|---|---|
| `README`, `CONTRIBUTING`, `AGENTS.md` or the equivalent agent-instruction file, `docs/` | Stated conventions override your defaults |
| Package manifest (`package.json`, `composer.json`, `pubspec.yaml`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml`, `Gemfile`) | Language, framework, scripts, existing dependencies |
| Lockfile (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `composer.lock`, `pubspec.lock`, `uv.lock`, `poetry.lock`) | The package manager you MUST use, and exact installed versions |
| CI config (`.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`) | **The authoritative list of validation commands** |
| Formatter / linter / type / analyzer config | The exact style gate your change must pass |
| Test directory and file naming | Where your tests go and what they look like |
| 2–3 files nearest the change | The pattern you are expected to follow |

CI config is the most reliable source of truth for how to validate. What CI runs is what "passing" means — prefer it over guessing commands or trusting a stale README.

Then read the code that will actually change. Read whole functions and their callers, not fragments. Trace one real path end to end.

**Identify the ecosystem, then load its skill.** Conventions apply in layers, narrowest last:

```
general engineering → language → framework → this repository
```

Where a `frameworks/*` skill exists for the detected framework (Laravel, NestJS, Next.js, React, Flutter), load it. Naming resolves through the `naming-conventions` skill, which is ecosystem-dependent and MUST NOT be answered from habit.

## 3. Search

**MUST** search before creating. Assume the capability already exists until you have confirmed it does not.

Search for the behavior three ways, because each misses different things:

- **By name** — the obvious identifier and its plausible synonyms (`tenant` and `organization`, `cancel` and `void`).
- **By symbol** — the function, class, type, or endpoint you were about to write.
- **By concept** — a distinctive string, an error message, a config key, or a route fragment.

Check specifically for an existing: function or service, component or widget, hook, validator or schema, repository or query, API client, type or DTO, error type, test helper or factory, and configuration key.

**NEVER** introduce a file, directory, abstraction, dependency, pattern, framework, or service before confirming an existing one does not already cover the need. Duplicated utilities and near-identical components are among the most expensive defects to unwind, because both copies acquire callers.

## 4. Plan

Decide, in order:

1. **Which layer owns this change?** → `architecture` skill.
2. **Which file does it belong in, and what is it called?** → `project-structure` and `naming-conventions` skills.
3. **What is the smallest edit that satisfies the requirement?**
4. **What could this break?** List the existing callers and tests you are about to affect.

For a multi-step or multi-file change, write the plan down before implementing. For a one-line fix, do not.

## 5. Implement

- Make the **smallest correct change**. Correct beats small; small breaks ties.
- Reuse the existing abstractions, helpers, and error types you found in step 2.
- Match the surrounding code's naming, structure, and idiom, even where you would personally write it differently.
- **NEVER** refactor code unrelated to the requirement. If you find an unrelated defect, report it; do not fix it uninvited.
- Preserve existing behavior that is not part of the requirement, including edge cases you did not fully understand.
- Validate incrementally on changes spanning more than a couple of files — do not write everything and run the tests once at the end.

Craft-level rules live in the `clean-code` skill.

**Upgrading existing functionality** follows the same loop, not a rewrite. Understand the current behavior and why it is the way it is, identify the specific deficiency, change that, and preserve everything else. A rewrite discards undocumented behavior that someone depends on.

## 6. Validate

**MUST** run the project's real checks. Use the commands CI uses.

```
format → lint → type check → tests → build (if the project builds)
```

Rules:

- **NEVER** report a test as passing that you did not run. If you could not run it, say exactly that.
- **NEVER** weaken a check to make it pass: no deleting or skipping tests, no loosening assertions, no blanket type escapes, no blanket lint suppression, no commenting out failing code, no widening a validation rule so bad input slips through.
- A missing or broken toolchain is a finding to report, not a reason to declare success.

**When validation fails:** investigate and fix it. A failure inside the scope of your change is your job, not a status update. Diagnose it with the `debugging` skill. Stop and report only when the fix requires a decision that is genuinely the user's (see below) or lies outside the requested scope.

## 7. Review

Read the actual diff. Do not review from memory of what you intended to write — that is where unintended files, debug statements, and stray edits survive.

Apply the `code-review` skill to your own change, then check off the [Definition of Done](references/definition-of-done.md).

## 8. Git Stage, Commit & Push

**MUST** complete after review and validation pass for every task:

1. Run `git status` to inspect all modified, added, and untracked files.
2. Run `git add -A` to stage **ALL** modified and newly created files completely without leaving any behind.
3. Run `git commit -m "..."` with a clear, descriptive commit message.
4. Run `git push origin main` to push the latest commit directly to GitHub.

## 9. Report

State plainly:

- What changed and where.
- What you verified, and **how** you verified it (which command, what result).
- What you did **not** verify, and why.
- Confirmation of Git commit hash and successful `git push origin main`.
- Anything you found but deliberately left alone.
- Assumptions you made, especially any you made instead of asking.

**NEVER** claim work is complete when part of it is unfinished, unverified, or not pushed to Git. Report failures with their actual output.

## Handling ambiguity

Do not invent business requirements. Do not silently pick one reading of a vague request and build it as if it were specified.

**MUST ask before proceeding** when the ambiguity materially affects:

- data models or persisted data shape
- money, billing, or pricing
- permissions, roles, or who can see what
- security or authentication behavior
- destructive or irreversible operations
- externally visible behavior or a public contract

**Decide yourself and state the assumption** when the ambiguity is a routine judgment call — naming, internal structure, log wording, which of two equivalent helpers to use. Ask questions at the point they block you, and finish everything that does not depend on the answer first.

## Version-sensitive claims

Framework, runtime, library, API, tooling, and security guidance goes stale. Training knowledge lags releases, and a confidently wrong version claim is worse than an admitted gap.

**MUST** verify against the installed version and current official documentation before making a version-sensitive recommendation. Establish the installed version from the lockfile, not the manifest range.

Treat these as version-sensitive by default: framework directory layouts and file conventions, caching and rendering defaults, deprecated or renamed APIs, recommended authentication patterns, build and bundler configuration, and security defaults.

Source priority: **official documentation for the installed version** → official repository and release notes → the specification → reputable engineering references → community posts.

**NEVER** invent an API, flag, configuration key, or method signature. If you cannot verify it, say so rather than producing something plausible. A generated example that does not exist costs more than no example.

## Scope discipline

The requested scope is the deliverable. Do not quietly narrow it, widen it, or transform it into a different task.

If part of the scope turns out to be blocked, complete every other part in full and say explicitly what you left out and why. Scaling the work down is the user's decision, not yours.

## References

- [Definition of Done](references/definition-of-done.md) — the completion checklist for every change.
- [Anti-patterns](references/anti-patterns.md) — behaviors that MUST NOT occur. Read when tempted to take a shortcut, or when a check will not pass.
- [Skill map](references/skill-map.md) — which skill owns which decision, and how to resolve conflicts between them.
