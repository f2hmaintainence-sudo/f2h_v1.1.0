---
name: ai-llm-integration
description: Use when building or changing application code that calls a large language model. Covers separating prompt templates from code, enforcing structured output with a schema and validating it before use, tool and function calling safety including confirmation before side effects, retrieval-augmented generation flows and chunking, context window and token budgeting, treating model output and retrieved documents as untrusted input, prompt injection defence, streaming, cost and latency control, non-determinism in tests, and handling refusals truncation and malformed output. Triggers on any model or completion API call, prompt construction, embeddings, a vector store, an agent or tool loop, chat history handling, or "add AI", "use an LLM", "structured output", "function calling", or "RAG". Provider-neutral - verify the specific API against the provider's current documentation.
compatibility: Model APIs and their parameters change frequently. Verify model identifiers, parameter names, and structured-output mechanisms against the provider's current documentation before relying on them.
metadata:
  category: domain
  version: "1.0.0"
---

# AI and LLM Integration

> **Rule strength:** MUST / NEVER are mandatory. SHOULD is the default — deviate only with a stated reason. CONSIDER is a judgment call.

An LLM is a non-deterministic remote dependency that returns untrusted text. Every rule here follows from that.

## Detect before writing

- Which provider SDK the project already uses, and its version. **NEVER** add a second SDK or an abstraction layer over one that works.
- Where prompts currently live, and whether they are versioned.
- The existing schema validation library — reuse it rather than adding another.
- How model calls are currently logged, retried, and rate-limited.

**MUST** verify model identifiers, parameter names, and the structured-output mechanism against the provider's current documentation. These change often, and an invented model name or parameter fails at run time in production. **NEVER** guess a model identifier. See the `agentic-development` skill on version-sensitive claims.

## Prompts belong in code, not scattered through it

- Keep prompt templates in **named, versioned modules or files**, not inlined as string literals at call sites. A prompt is behavior: it needs to be reviewable, diffable, and testable.
- **MUST** separate the template from the interpolated data. Build the prompt from typed parameters so a caller cannot accidentally omit or duplicate a field.
- **NEVER** build a prompt by concatenating untrusted user input into instructions. Place user content in a clearly delimited data region, and state in the instructions that content within it is data, not commands.
- Keep instructions specific and negative-constrained where it matters ("if the field is absent, return null; do not guess"). Vague instructions produce vague output.
- Record which prompt version produced a stored output, so a regression can be traced.

## Structured output

Free text is unparseable in the general case. **MUST** use a schema whenever the output feeds code rather than a human.

The required pattern:

```
1. Define the schema once, in the project's validation library
2. Derive the provider's schema format from it — never hand-maintain two copies
3. Request structured output through the provider's mechanism
4. Validate the response against the schema
5. On validation failure: retry with the error, or fail loudly. Never proceed.
```

- **MUST** validate the model's output before using it, even when the provider claims to enforce the schema. Truncation, refusals, and edge cases still produce non-conforming output.
- **MUST** derive the wire schema from the code schema so they cannot drift. Maintaining a validation schema and a separate hand-written JSON schema guarantees they diverge.
- Prefer a flat, shallow schema with explicit enumerations over deep nesting and open strings. Models comply far more reliably with a constrained shape, and enumerated values are checkable.
- Describe each field in the schema. Field descriptions are instructions the model actually follows.
- Make optionality explicit. A model asked for a required field it cannot determine will invent one; an explicitly nullable field lets it say so.
- **NEVER** parse structured data out of prose with a regular expression when the provider supports a structured mode.
- **NEVER** feed unvalidated model output into a query, a shell command, a file path, a URL, or rendered HTML. It is untrusted input — see the `security` skill.

Note for schema libraries with a recent major version: verify the current API rather than reusing older idioms. As one example, in Zod 4 the string-format validators moved to top-level functions (`z.email()` rather than `z.string().email()`), `z.record()` requires both key and value types, and `z.strictObject()` replaces `.strict()`.

## Tool and function calling

A tool call is the model requesting that your code perform an action. The model is not an authority.

- **MUST** validate every tool argument against a schema before executing. Arguments are model-generated and may be malformed, out of range, or hostile.
- **MUST** enforce authorization inside the tool implementation, scoped to the actual end user — not to the application's own credentials. A tool that reads any record because the service account can is a data-exposure defect. See the `security` skill.
- **MUST** require explicit human confirmation before any tool with an irreversible or externally-visible effect: sending a message, charging money, deleting data, modifying permissions, deploying. **NEVER** let a model trigger those unattended.
- Keep tools narrow and single-purpose. A `run_query` or `execute_code` tool grants the model whatever that primitive can do; scope it to the specific operations you intend.
- Return errors to the model as structured, actionable text so it can correct itself — but **NEVER** include internal detail, stack traces, or credentials in what you return.
- **MUST** bound the agent loop: a maximum number of iterations, a wall-clock timeout, and a token or cost ceiling. An unbounded loop is a runaway bill and a hung request.
- Make tools idempotent where a retry is possible, since the loop may call one twice. See the `backend-engineering` skill.

## Retrieval-augmented generation

- **Retrieval quality determines answer quality.** When answers are wrong, examine what was retrieved before changing the prompt. Measure retrieval separately from generation, or you cannot tell which half is failing.
- **MUST apply the user's access permissions at retrieval time**, as a filter in the query rather than after the fact. A retrieval layer that ignores permissions leaks every document it indexes, and the leak surfaces as a plausible answer rather than an error.
- Chunk on semantic boundaries — sections, paragraphs, function definitions — not fixed character counts that cut sentences apart. Include enough surrounding context that a chunk is meaningful alone.
- Store and return **source metadata** with every chunk so the answer can cite it and a user can verify it.
- **MUST** instruct the model to answer only from the provided context and to say when the context is insufficient. Without that, it fills gaps from training data and the answer looks identical.
- Treat retrieved documents as **untrusted input**: a document containing instructions is a prompt-injection vector, particularly where users can add documents to the index.
- Re-index when source content changes. A stale index answers confidently and wrongly.
- Consider whether retrieval is needed at all. If the corpus fits in the context window and is stable, passing it directly is simpler and more accurate.

## Context and token budgeting

- **MUST** budget the context window explicitly: system instructions, tools, retrieved context, conversation history, and reserved output space must fit, with headroom. Exceeding it fails the request or silently drops content.
- **MUST** reserve space for the output. A prompt that fills the window leaves no room to answer, and the response truncates mid-structure — which is why schema validation must handle truncation.
- Truncate conversation history deliberately: keep the system instructions and recent turns, and summarize or drop the middle. **NEVER** let history grow unbounded; cost and latency grow with it and the window eventually overflows.
- Count tokens with the provider's tokenizer, not by estimating from characters, wherever a decision depends on the number.
- Put stable content (instructions, schemas, long reference material) at the start of the prompt and variable content last, so provider-side caching can apply.

## Cost, latency, and failure

- **MUST** set an explicit timeout. Model calls are slow and variable; a default of infinite will exhaust your request capacity.
- Retry on transient failures — rate limits, timeouts, 5xx — with exponential backoff and jitter, bounded. **NEVER** retry a refusal or a validation failure identically; change the input or fail.
- **MUST** log the model identifier, token counts, latency, and cost per call. Without these you cannot diagnose a regression or a bill.
- **NEVER** log full prompts or completions containing personal data or secrets. Redact, sample, or log references. See the `security` skill.
- Stream where the user waits on prose. Do not stream when you must validate a complete structured object before acting on it.
- Decide the degraded behavior deliberately: fail the request, fall back to a cheaper model, serve a cached answer, or omit the feature. Say which in the code.
- Rate-limit and cap spend per user. An unmetered model endpoint is a denial-of-wallet vulnerability.

## Testing

- **NEVER** assert on exact model output. It is non-deterministic; the test will be flaky and will be deleted.
- Test the **deterministic parts** with the model call substituted: prompt construction, schema validation, tool argument validation, retrieval filtering, truncation, and error handling. This is where nearly all the defects are.
- Assert on **properties** rather than text where a real call is involved: the schema validates, required fields are present, values fall in the enumerated set, no forbidden content appears.
- Keep a small set of recorded fixtures for known-good and known-bad responses, including a truncated response and a refusal, and test that the code handles each.
- **MUST** substitute the provider in unit tests. Real calls make the suite slow, expensive, and non-deterministic. See the `testing` skill.

## Anti-patterns

| Anti-pattern | Correct approach |
|---|---|
| Prompt strings inlined at call sites | Named, versioned template modules |
| User input concatenated into instructions | Delimited data region, marked as data |
| Parsing prose with a regex for structured data | Schema-enforced structured output |
| Trusting provider-enforced schemas without validating | Always validate the response |
| Two hand-maintained schema copies | Derive the wire schema from the code schema |
| Model output passed into a query, command, or path | Treat as untrusted; validate and escape |
| Tool executing without validating its arguments | Validate against a schema first |
| Tool authorized by the service account | Scope to the end user's permissions |
| Model triggering an irreversible action unattended | Require explicit confirmation |
| Broad `execute_code` or `run_query` tool | Narrow, single-purpose tools |
| Unbounded agent loop | Cap iterations, time, and cost |
| Retrieval ignoring user permissions | Filter at query time |
| Fixed-character-count chunking | Chunk on semantic boundaries |
| No instruction to abstain when context is insufficient | Require it, or it will confabulate |
| Unbounded conversation history | Truncate or summarize deliberately |
| Prompt filling the whole window | Reserve output space |
| Guessed model identifier or parameter name | Verify against current documentation |
| Asserting exact output in a test | Test deterministic parts and properties |
| Logging full prompts containing personal data | Redact or log references |

## Related skills

- `security` — untrusted input, injection, secrets, authorization.
- `backend-engineering` — timeouts, retries, idempotency, observability.
- `performance` — latency, caching, and cost as measurable budgets.
- `api-design` — contracts for endpoints that wrap a model.
- `testing` — substituting non-deterministic dependencies.
