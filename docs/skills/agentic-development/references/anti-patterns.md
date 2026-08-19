# Anti-patterns

Behaviors that MUST NOT occur, grouped by the pressure that produces them. Each entry names the honest alternative.

## Under pressure to make a check pass

These are the most damaging, because they convert a visible failure into a hidden one.

| Anti-pattern | Do instead |
|---|---|
| Deleting or skipping a failing test | Fix the code, or fix the test if the test is genuinely wrong — and say which |
| Weakening an assertion until it passes | Diagnose why the actual value differs |
| Catching an error and returning a default to make a path "work" | Let it fail, or handle it deliberately at a level that can act on it |
| Using `any`, an unchecked cast, or a type-ignore comment to silence a type error | Model the type correctly, or narrow with a real runtime check |
| Adding a lint suppression without reading the rule | Understand the rule, then fix the code or justify the suppression in a comment |
| Commenting out failing code | Fix it or remove it deliberately |
| Loosening validation so bad input passes | Fix the caller or the schema |
| Removing a security control that is "in the way" | Satisfy the control |
| Reporting tests as passing without running them | Report exactly what you ran and what you did not |

## Under pressure to produce something

| Anti-pattern | Do instead |
|---|---|
| Fabricating an API response, schema, or file contents | Read the real thing; if unavailable, say so |
| Writing a stub that returns hardcoded data and calling it done | Implement it, or clearly label it unimplemented in the report |
| Inventing a business rule the user never specified | Ask, when it materially matters; otherwise state the assumption |
| Claiming a change is complete when part is unfinished | Report exactly what is done and what is not |

## Under pressure to "improve" things

| Anti-pattern | Do instead |
|---|---|
| Rewriting large parts of the project unprompted | Make the requested change; report improvement opportunities separately |
| Refactoring unrelated code found along the way | Leave it; mention it |
| Reformatting files the change did not touch | Restrict formatting to lines you edited |
| Renaming things for personal preference | Follow existing naming |
| Swapping a framework, build tool, ORM, or data store | Requires explicit approval |
| Restructuring the database schema without justification | Requires explicit approval and a data-preserving migration |

## Under pressure to move fast

| Anti-pattern | Do instead |
|---|---|
| Creating a new file when an existing one is the right home | Inspect neighbors first |
| Creating a second utility that duplicates an existing one | Search by name, symbol, and concept before writing |
| Duplicating a component instead of extending it | Extend, or extract only once the repetition is real |
| Installing a dependency for something the project already has | Check existing dependencies first |
| Adding an abstraction for a single use site | Wait until the pattern actually repeats |
| Guessing at existing behavior instead of reading it | Read the code and its callers |
| Hardcoding a secret, key, or token "temporarily" | Never. Use the project's configuration mechanism |
| Committing without being asked | Commit only on request |
| Running a destructive git or database operation to clear an obstacle | Requires explicit permission |

## The underlying rule

Every anti-pattern above trades a **visible problem** for an **invisible** one. Surfacing the problem is always in scope. Concealing it never is.
