---
name: documentation
description: Use when deciding what to write down, where to put it, and when existing documentation has been invalidated by a change. Covers recording architectural decisions and their reasoning, documenting non-obvious behavior and constraints, setup and operational requirements, API contracts, README structure, code-level docs, and keeping documentation accurate as behavior changes. Triggers on "document this", "update the README", "write an ADR", adding a setup step or environment variable, changing a public contract, or making a decision that a future reader would otherwise have to reverse-engineer. Also use to decide when documentation is not warranted, since unnecessary or stale documentation is worse than none.
metadata:
  category: domain
  version: "1.0.0"
---

# Documentation

> **Rule strength:** MUST / NEVER are mandatory. SHOULD is the default — deviate only with a stated reason. CONSIDER is a judgment call.

Write documentation that answers questions the code cannot answer for itself. Everything else is a maintenance liability.

## What to document

**SHOULD document:**

| Subject | Because |
|---|---|
| Architectural decisions and the alternatives rejected | The code shows what was chosen, never why, and the reasoning is what a future change needs |
| Non-obvious behavior and deliberate deviations | Otherwise the next reader "fixes" it |
| Constraints imposed from outside | Rate limits, external system quirks, legal or compliance rules, backward-compatibility obligations |
| Setup requirements | Prerequisites, environment variables, services, credentials, first-run steps |
| Operational requirements | How to run, deploy, monitor, roll back; what breaks and what to do about it |
| Public contracts | API endpoints, event payloads, library surfaces — anything with consumers you cannot edit |
| Data model decisions | What a non-obvious column, status value, or relationship actually means |

**MUST NOT document:**

- What the code plainly says. A file describing each function's steps goes stale immediately and is never trusted again.
- A change log written by hand where version control already records it.
- Aspirational descriptions of behavior that does not exist yet.
- Documentation nobody asked for, restating what is already written elsewhere.

**Decision rule:** if a competent developer reading the code would still ask "why?" or "how do I run this?", document it. If they would not, do not.

## Where it goes

Put documentation as close as possible to what it describes, and in exactly one place.

| Content | Location |
|---|---|
| What the project is, how to run it, how to test it | `README.md` |
| Why a significant decision was made | An ADR under `docs/` (see below), or the project's existing decision record |
| Why a specific line or block is unusual | A code comment — see the `clean-code` skill |
| What a function, type, or endpoint accepts and returns | A doc comment on the declaration |
| Contribution workflow and conventions | `CONTRIBUTING.md` |
| Runbooks and operational procedures | `docs/` or the project's existing operations location |

**MUST** follow the project's existing documentation location and format. Do not introduce a `docs/` tree, a wiki convention, or an ADR format into a project that already has a different one.

**NEVER** duplicate the same information in two places. It will diverge, and readers will not know which is current. Keep one home and link to it.

## Architectural decision records

Worth writing when a decision is **expensive to reverse** and **not obvious from the code**: choosing a data store, a boundary between services, an authentication model, a significant dependency, a consistency or concurrency strategy.

Keep it short — one page. A useful ADR contains:

```markdown
# <number>. <decision, stated as a title>

Status: Accepted | Superseded by <link>
Date: <YYYY-MM-DD>

## Context
The problem, and the constraints that mattered.

## Decision
What was chosen, stated plainly.

## Alternatives considered
What else was viable, and why it was not chosen.

## Consequences
What this makes easy, what it makes hard, and what must be revisited if the
constraints change.
```

The **alternatives** and **consequences** sections carry most of the value; a record without them is not worth the file. Never edit a decided record to reflect a new decision — write a new one and mark the old superseded.

## README

A README's job is to get a new reader productive. In order:

1. What this project is, in one or two sentences.
2. Prerequisites — versions and required services.
3. Install, configure, and run — as **commands that actually work**, verified.
4. How to run the tests.
5. Anything else that will bite someone in the first hour.

**MUST** verify commands before writing them. A README instruction that fails on a clean checkout is worse than a missing one, because it burns trust in the whole document.

Deeper material belongs in linked pages, not in a README that nobody finishes.

## Code-level documentation

- Doc comments on public declarations SHOULD state the contract a caller needs: what it does, what the parameters mean (including units), what it returns, what it throws or rejects with, and any side effect.
- Skip doc comments that restate the signature. `/** Gets the user. */` on `getUser(id)` is noise.
- Document the non-obvious: units, allowed ranges, nullability, thread-safety or concurrency expectations, ordering guarantees, and idempotency.
- Follow the project's existing doc comment convention and generator, if it has one.

## Keeping it accurate

**MUST** update documentation in the same change that invalidates it. Stale documentation is more harmful than absent documentation, because it is believed.

When your change touches any of these, check the corresponding docs:

- A new or renamed environment variable, config key, or required service → setup docs and `.env.example`
- A changed API contract, response shape, or event payload → API documentation
- A changed setup, build, or deployment step → README and CI docs
- A behavior an existing document explicitly describes → that document
- A decision that supersedes a recorded one → a new record marking the old superseded

If you find documentation that was already wrong before your change, **report it** rather than silently expanding scope to fix it.

## Writing style

- Say what to do. Prefer "run `npm test`" over "you may wish to consider running the tests".
- Prefer a table, a list, or a working example over a paragraph.
- Date and scope anything time-sensitive so a reader can judge whether it is still true.
- Do not pad. Length is not thoroughness.

## Related skills

- `clean-code` — comments that explain why, inside code.
- `api-design` — contract documentation for consumers.
- `architecture` — the decisions worth recording.
