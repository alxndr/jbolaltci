# 000 — adopt a framework for capturing architecture decisions

**Date:** 2026-08-15

**Status:** Implemented


### Context

This repo has, by this point, accumulated a real number of decisions worth capturing -- vendoring vs. porting third-party code, ESM-only vs. dual-format builds, cache-first lookup design, what belongs in the library vs. the web app's display layer, CI architecture, and more -- that were made and discussed at length but only live in commit messages and chat history. Neither is a durable, browsable record: commit messages describe *what* changed, not the options considered or why one was chosen, and chat history isn't part of the repo at all.

This project is developed with the assistance of AI coding assistants, which don't carry context between sessions the way a human maintainer does. Recent research on this specifically: contextual ADR history measurably improves an LLM's decision-generation quality over no context at all, and a small recency window of the last 3-5 records gets most of the benefit without much extra cost (see the arXiv paper linked below). ADRs are also being described as a form of durable memory for agents in a way they were never quite needed to be for humans -- a human forgets and can be reminded; an agent starting a fresh session never knew in the first place.

The risk runs the other way too: a stale or outdated ADR can be worse than no ADR at all, since an agent has no independent way to sense that a written decision no longer reflects reality and may follow it literally, producing confidently-wrong output built on an obsolete premise. That's a real argument for keeping this format minimal and low-friction (below) rather than heavyweight -- a document nobody bothers to update is exactly this failure mode waiting to happen.

This framework and its format are adopted directly from the pattern established in [alxndr/sparse-boolean-codec](https://github.com/alxndr/sparse-boolean-codec/tree/main/docs/architecture-decisions), for consistency across projects.

#### Links

* ["Architecture Decision Records: Templates and Operational Patterns for Teams That Actually Maintain Them"](https://hidekazu-konishi.com/entry/architecture_decision_records_templates_and_operations.html)
* ["ADRs for Coding Agents: Architectural Context, Optimized"](https://www.actual.ai/blog/agent-optimized-adrs) -- on restructuring ADRs for an agent reader rather than a human one
* ["Context Matters: Evaluating Context Strategies for Automated ADR Generation Using LLMs"](https://arxiv.org/html/2604.03826v2) -- the empirical result on recency-windowed ADR context improving generation quality
* ["Architecture Decision Records for AI Agent Codebases"](https://websiteinit.com/blog/architecture-decision-records-for-ai-agent-codebases/) -- on the stale-ADR-is-worse-than-no-ADR risk


### Decision

Keep track of important decisions and the context around them, in easily-readable Markdown files, collected in `./docs/architecture-decisions/`.

Format, kept deliberately minimal given the staleness risk above:

* a **numbering scheme**
* a **Date** (not necessarily matching the order of the numbering scheme, if a decision was made in the past but is getting documented later)
* a **Status** (e.g. `Proposed`, `Accepted`, `Implemented`, `Superseded by 00X`, `Rejected`)
* a **Context** section
* a **Decision** section

More sections may be added in the future.

One more rule, directly motivated by the staleness risk above: **once an ADR's `Status` is `Implemented` and the file has been committed, don't edit its Context or Decision text.** If the decision changes, write a new ADR and change the old one's `Status` to `Superseded by 00X`. An ADR that can be quietly rewritten after the fact isn't a reliable record of what was actually known and decided at the time -- for a human re-reading it later or an agent consulting it in a future session, an edited-in-place "historical" decision is indistinguishable from an accurate one, which is exactly the failure mode described above.

This doesn't apply to drafting: revising an ADR before its first commit, or while its `Status` is still `Proposed`/`Accepted` and the decision hasn't been built yet, is normal iteration, not an amendment to settled history. Advancing `Status` itself over a record's lifecycle (`Proposed` → `Accepted` → `Implemented`) is expected and is not the kind of edit this rule is about -- it's the Context and Decision text that freezes once something is actually built.
