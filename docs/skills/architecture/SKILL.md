---
name: architecture
description: Use when deciding how code should be organized into layers, modules, or services, and which way dependencies may point. Covers separation of concerns, dependency direction and inversion, keeping domain logic out of UI and controllers, containing data-access code, module boundaries, and avoiding god modules and circular dependencies. Triggers on "where should this logic live", "how should I structure this", adding a new module or service, introducing an interface or abstraction layer, or any change that spans presentation, business logic, and storage. Also use when reviewing whether a change fits the existing architecture, or when tempted to introduce a layered or hexagonal architecture into a project that does not already have one. Not for file and directory placement - use project-structure for that.
metadata:
  category: foundation
  version: "1.0.0"
---

# Architecture

> **Rule strength:** MUST / NEVER are mandatory. SHOULD is the default — deviate only with a stated reason. CONSIDER is a judgment call.

## First: identify the architecture that already exists

**MUST** do this before proposing any structural change. Read the top-level source directories, then trace one existing request or operation end to end — from entry point to storage and back.

Answer these before deciding anything:

- What are the existing layers, and what is each one named?
- Where does business logic live today?
- How does code reach the database — directly, through a repository, through an ORM model?
- Are there existing interfaces or ports, and are they real seams or decoration?
- Do modules depend on each other, or only on shared lower layers?

The architecture you find outranks the architecture you would have chosen. Follow it unless it causes a concrete technical problem, and say so if you deviate.

## Choosing an architecture (new projects or new subsystems only)

**NEVER** impose Clean Architecture, hexagonal, DDD, CQRS, event sourcing, or microservices on a project that does not already use them.

Choose the simplest structure that satisfies:

- current requirements
- realistically expected scale
- testability of the business rules
- maintainability by the team that owns it
- the complexity the team can actually carry

Concrete progression — start at the top and move down only when a real pressure demands it:

| Structure | Adopt when |
|---|---|
| Single module, logic beside its entry point | Small or short-lived; few contributors |
| Separate domain/service layer from entry points and storage | Business rules exist that outlive any one endpoint or screen |
| Modules per feature, with explicit public surfaces | Multiple features evolve independently; cross-feature edits keep breaking things |
| Ports and adapters (interfaces at the boundary) | External systems must be swapped or faked, or domain tests must run without infrastructure |
| Separate deployable services | Independent scaling, isolation, or release cadence is a real, present requirement |

Extra layers are not free. Each one costs indirection, navigation, and mapping code. Add one when it removes more complexity than it introduces.

## Dependency direction

**MUST** hold in any layered project:

```
presentation  →  application/service  →  domain
                        ↓                  ↑
                  infrastructure  ─────────┘  (via interfaces owned by domain)
```

- Dependencies point **inward**, toward business rules.
- The domain layer MUST NOT import HTTP types, UI types, ORM entities, SDK clients, or framework annotations from outer layers.
- When an inner layer needs an outer capability (sending mail, storing a file, calling an API), the **inner layer defines the interface** and the outer layer implements it. This is dependency inversion; it is the only mechanism that keeps the arrow pointing inward.
- **NEVER** create a circular dependency between modules or layers. A cycle means the boundary is drawn in the wrong place — extract the shared concept, or move the code to the side that owns it.

If the project is not layered, the rule reduces to: **stable code MUST NOT depend on volatile code.**

## Separation of concerns

Each of these is a distinct responsibility. Mixing them is the most common architectural defect.

| Concern | Owns | MUST NOT contain |
|---|---|---|
| Presentation (UI, controllers, handlers) | Input parsing, formatting, transport, rendering | Business rules, direct queries, transaction control |
| Application / service | Use-case orchestration, transaction boundaries, authorization checks | Rendering, SQL string building, transport details |
| Domain | Business rules, invariants, domain types | I/O of any kind, framework dependencies |
| Data access | Queries, mapping, persistence | Business decisions, permission logic |
| Infrastructure | External systems, clients, config, wiring | Rules the business would recognize |

Two specific violations to watch for:

- **Business logic in UI or controllers.** A rule the business would recognize ("orders over X need approval", "a cancelled subscription still gets access until period end") belongs in domain or service code, where it can be tested and reused. Controllers translate; they do not decide.
- **Data-access code scattered through the application.** Queries, raw SQL, and ORM calls SHOULD be confined to the data-access layer. Otherwise schema changes ripple everywhere and query cost becomes impossible to see. See the `database` skill for query and schema rules.

## Module boundaries

- A module SHOULD have one clear reason to exist and one owner concept.
- Expose a deliberate public surface. Everything else stays internal — importing another module's internals defeats the boundary.
- Cross-module communication goes through that public surface, not through shared mutable state.
- Shared code belongs in a module named for what it *is* (`money`, `time`, `validation`), never for where it happens to sit (`common`, `shared`, `core`). See the `project-structure` skill.

**God modules and god services** — a file or class that keeps growing because it is where things go — are a boundary failure, not a size problem. Split by responsibility, not by line count. Symptoms: unrelated changes keep touching the same file; the name contains "Manager", "Handler", "Service", "Util" with no narrower meaning; nobody can state what it does in one sentence.

## Changing an existing architecture

A structural change is a separate deliverable from a feature. Do not smuggle one inside the other.

Before proposing one, state: the concrete problem it solves, what breaks, the migration path, and what happens if it is only half-finished. If the migration cannot be done incrementally with the system working at every step, it is too large to start unprompted.

Architectural decisions that are hard to reverse SHOULD be recorded — see the `documentation` skill.

## Related skills

- `project-structure` — where the files actually go once the layer is decided.
- `frameworks/*` — architecture the framework already imposes; check before designing your own.
- `backend-engineering`, `frontend-engineering` — layer-specific rules inside a chosen architecture.
- `database` — persistence design within the data-access boundary.
