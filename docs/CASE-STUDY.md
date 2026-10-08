# Supabase AI Story Reference — case study

## Problem and scope

A reviewer should be able to inspect how a small application protects its users' data, runs controlled server-side work and recovers from failures. This reference uses a fictional five-page story workflow to make those concerns concrete. It complements Noor Shaikh's consulting and technical program experience with hands-on, AI-assisted implementation evidence.

The working application supports confirmed email accounts, private story drafts and images, authenticated generation, saved job history and private updates across open tabs. An account-free `/demo` presents a bundled fictional example; `/architecture` explains the implementation. The sample does not execute an AI call or impersonate a live private session.

## Decisions

| Decision | Reason and tradeoff |
| --- | --- |
| One immutable story owner; children derive access from their parent | Keeps authorization consistent across pages, assets and jobs. Requires indexed parent lookups and actual-role RLS tests. |
| Caller JWT plus a narrow worker capability | Allows controlled generation transitions without a service-role application client. Provisioning, rotation and interrupted work need explicit operational handling. |
| Deterministic mock provider by default | Makes the core reproducible without a paid key, provider availability or transmitting real personal information. Optional Gemini code exists; live paid-provider behavior is unverified. |
| Private Broadcast as a notification hint | Open tabs refetch authorized persisted state after a change or reconnect. Messages are best-effort, not a durable event queue. |
| Reserved image paths and reviewed cleanup | Handles failures across Storage and Postgres without pretending there is a distributed transaction. Cleanup is eventual and requires identity/race checks. |
| Separate public sample and private application | Lets a recruiter understand the project without signing up while retaining owner-only access to actual account data. |

## A concrete debugging example

An initial private Realtime receive policy checked a field that the authorization probe did not populate as expected. Tests using ordinary private messages missed that difference. Inspecting the pinned Realtime implementation revealed the probe shape. The policy and regression tests were corrected while retaining owner, role, topic and extension checks. Producer and subscriber private flags remain separate requirements. This was a project assumption corrected through evidence, not a claimed upstream defect.

## Verification and limits

The October 7 core/hardening checkpoint passed 306 unit tests, 356 SQL assertions and seven browser scenarios. It also exercised eleven authenticated query plans and a concurrent quota boundary. See [the execution record](LOCAL-HARDENING.md) for commands, earlier failures and measurement limits, and [publication progress](PUBLICATION.md) for subsequent demo verification.

These results establish tested local behavior. They do not establish hosted capacity, a clean full dependency audit, an independent security audit, human release approval or accepted upstream work. Generation uses bounded requests and manual lease recovery; there is no durable background worker. Publication and hosting must be verified separately.

## Ownership and development process

The project was developed with Codex assistance through reviewed phases, using official Supabase guidance, versioned migrations and explicit acceptance checks. Nine generic files were selectively reused with authorization and recorded hashes. Commercial data, private prompts and commercial assets were excluded. [AI-DEVELOPMENT.md](AI-DEVELOPMENT.md) records the division of work and the human reviews still outstanding.

## Reviewer path

Read the public sample, inspect [the architecture](ARCHITECTURE.md), then follow [the 10–15 minute source tour](REVIEWER-GUIDE.md). For an interview, discuss one ownership policy, one failure/recovery path and one deliberately deferred feature. Current public URLs and execution status belong in [PUBLICATION.md](PUBLICATION.md); no unverified deployment or contribution is implied by this case study.
