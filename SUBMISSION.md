# WebMCP Challenge — Submission Notes

**Live URL:** https://safeu.netlify.app
**Judge guide (3-min verification):** https://safeu.netlify.app/judge.html
**Repo:** https://github.com/junha-research/safeu (MIT)
**Video:** (YouTube link — add before submitting)

---

## Devpost description (paste-ready)

### What is safeU?

From June 2026, Korea's amended Occupational Safety and Health Act makes workplace risk assessment directly fineable — up to ₩10M — with fines phasing in through 2027–2028. Yet only ~34% of workplaces have ever completed one, and in companies under 50 workers, 45% have nobody assigned to safety at all. The person holding the pen is a 50-something factory owner. He doesn't know which duties apply to him, he distrusts the "mandatory training" telemarketers who exploit that confusion, and a blank government form paralyzes him.

safeU is a free, no-signup web app where he and his AI agent complete the whole thing together: the agent diagnoses his legal duties (with statute citations and real fine amounts), drafts the risk assessment — even by reading his old HWP/PDF/Excel files or a photo of a paper form — and the human confirms every row, records worker participation, and prints an inspection-ready pack of up to six documents, including a toolbox-meeting (TBM) log that legally counts toward mandatory training hours and a Serious-Accidents-Act semiannual check sheet.

### Why this use case is a strong fit for WebMCP

The 2026 amendment requires **worker participation and result-sharing**, each fineable up to ₩5M. An AI legally cannot finish this document alone — the law itself mandates a human in the loop. safeU turns that legal boundary into the tool boundary: everything the statute lets a manager delegate is an agent-callable WebMCP tool; everything the statute reserves for humans (confirming rows, recording participation, signing, printing) has **no tool at all** — enforcement by schema absence, not by validation. A human-confirmed row is locked: the update tool refuses and tells the agent exactly what to ask the person, citing the statute.

And the tool surface itself is alive: safeU registers tools with `AbortSignal` and re-syncs them with the document lifecycle. The moment the last row is confirmed, participation recorded and the document signed, **the assessment write tools unregister** — agents watching `toolchange` see the document seal itself (operational tools like the TBM briefing survive, since they never mutate the sealed pack). A human unlocking a row brings the write tools back. This division of labor is only expressible when the agent and the human share the same live page — which is precisely what WebMCP provides and what a chatbot, a scraper, or a server-side MCP cannot.

### How it creates a better user experience

For a user who has never used AI, the interface is his own screen: the agent's every action is visible — rows slide in with amber "Agent draft" badges, a toast announces each tool call, `request_human_review` physically scrolls the page and pulses the rows needing his eyes. He never pastes anything into a chat window; he answers questions out loud and clicks Confirm. And for his documents, the roles finally match reality: the page ships zero file-parsing code, because the agent itself reads his HWP/PDF/Excel/photos and fills the table via `add_risk_assessment_rows(imported_from: …)`. No signup, no backend — everything stays in his browser.

### What people and agents can do together that was difficult or impossible before

- Turn "what must my workplace legally do?" — a question even Korean labor consultants answer inconsistently — into a cited, size- and industry-specific checklist in under a minute.
- Convert a consultant's old HWP report, a KRAS Excel export, or a photo of a paper form into a live, editable, legally current assessment — no competitor in the Korean safety-SaaS market imports any existing file.
- Produce the newest and vaguest legal artifact — worker-participation evidence (meeting minutes, result-sharing confirmation with signature lines, postable summary) — as a printable pack an inspector recognizes.
- Do all of it with an auditable human/agent boundary: the printed document is something a human demonstrably reviewed, because the system makes it impossible for the agent to fake that.

### How we implemented WebMCP

Eight tools via `document.modelContext.registerTool` (with a `navigator.modelContext` fallback), in the top-level page (ChatGPT ignores iframes): `get_site_status`, `set_workplace_profile`, `search_regulations`, `add_risk_assessment_rows`, `update_risk_assessment_row`, `request_human_review`, `prepare_tbm_briefing`, `check_inspection_readiness`. The surface is **journey-stage dynamic**: each tool registers with an `AbortSignal` and a store subscription re-syncs the set on every state change (observable via `toolchange`) — assessment write tools exist only between "profile set" and "document sealed", while `prepare_tbm_briefing` requires human-confirmed rows and survives the seal; `get_site_status` returns a `journey` block (goal, step states, `next_action`) so agent and human drive toward the same deliverable. Read-only tools carry `readOnlyHint`. Human-only fields (`human_confirmed`, worker participation, signatures) exist in **no** inputSchema, and all schemas set `additionalProperties: false`. Every mutating tool returns a `human_action_needed` string citing the statute, so the page teaches the agent the division of labor; every execute is wrapped to emit an on-screen activity toast and auto-switch tabs so the human always sees what the agent did. Tool count and return payloads are deliberately capped to respect the agent's context window. UI and tools mutate one shared localStorage-backed store, so human clicks and agent calls are literally the same code path. Data (statutes, duties, hazard library) is bundled, verified against law.go.kr — Korean statutes carry no copyright (Copyright Act Art. 7).

---

## Demo video script (2:30)

1. **Hook (0:15)** — "From 2028, Korean workplaces under 50 people can be fined up to ₩10M for skipping risk assessments. 66% have never done one. And the new law demands the one thing AI can't do: worker participation."
2. **Diagnosis (0:20)** — Ask agent: "I run a 12-person metal shop — what safety paperwork do I need?" → `set_workplace_profile` → duty dashboard builds live: D-day counter, 10 duties with statutes and fines.
3. **Draft (0:35)** — Attach last year's HWP to the agent chat: "Read this and put it into safeU." → rows appear with "Imported" badges → agent fills missing measures via `update_risk_assessment_row`. Line: "The page can't read this file. The agent can — and it fills the page."
4. **The legal wall (0:30)** — "Are we inspection-ready?" → `check_inspection_readiness` → red blockers tagged 👤 you: worker participation, signatures. Agent explains why it can't do those, calls `request_human_review` — the page scrolls and pulses. Human confirms rows, **changes one severity rating** (human correcting the agent — say it), types worker names, signs.
5. **The seal (0:15, money shot)** — the instant the signature lands, a toast fires: *"Document sealed — 3 write tools unregistered."* Show the agent's tool list shrink (toolchange). Ask the agent to add a row — it can't. VO: "The law says humans finish this document. Now even the tool surface says it."
6. **Close (0:35)** — "Prepare tomorrow's TBM." → `prepare_tbm_briefing` (works because rows are now human-confirmed) → Print: a 6-document inspection pack — assessment with signature lines, participation minutes, sharing confirmation, postable summary, TBM log ("15 min × attendees counts toward statutory training hours"), Serious-Accidents-Act semiannual check sheet. Tagline: **"Agent drafts, humans decide — because here, human participation is the law."**

## Judge testing notes

- Chrome 149+: enable `chrome://flags/#enable-webmcp-testing`, open https://safeu.netlify.app
- ChatGPT desktop in-app browser: works out of the box (personal account)
- The site works fully manually in any browser; `window.__safeuTools` exposes the same tool objects for inspection.
