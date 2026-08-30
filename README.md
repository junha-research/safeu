# 🦺 safeU

**Korean workplace-safety compliance, done together by a human and their AI agent — on the same live page.**

A [WebMCP Challenge 2026](https://webmcp.devpost.com) entry. MIT licensed.

> **Live demo:** https://safeu.netlify.app · **Judges: 3-minute verification guide → [safeu.netlify.app/judge.html](https://safeu.netlify.app/judge.html)** · **Demo video:** (YouTube link)

---

## The problem

From June 2026, Korea's amended Occupational Safety and Health Act (산업안전보건법) makes workplace **risk assessment** directly fineable — up to ₩10,000,000 for not doing it, with fines phasing in on 2027-01-01 (50+ workers) and 2028-01-01 (under 50). Yet only ~34% of workplaces have ever done one. In companies with fewer than 50 workers, 45% have *nobody* assigned to safety work: the person filling out these documents is a 50-something factory owner or an admin clerk who inherited the job. They don't know which duties apply to them, they distrust the "mandatory training" sales calls that exploit that confusion, and when they open a blank risk-assessment form they freeze.

And here is the twist that makes this a WebMCP problem: **the 2026 amendment requires worker participation and result-sharing, each fineable up to ₩5,000,000.** An AI cannot legally finish this document alone. The law itself demands a human in the loop.

## What safeU does

safeU is a free, no-signup, browser-only tool where **the agent does everything the law lets a manager delegate, and humans do everything the law reserves for humans** — on the same live page:

- **Duty diagnosis** — industry + headcount → the exact legal duties that apply, each with its statute citation, real fine amounts, and enforcement dates. Built for people who need to tell real obligations from telemarketing.
- **Collaborative risk assessment** — the agent drafts hazard rows (from an interview, or by reading the user's existing HWP/PDF/Excel/photo documents); every agent row lands as an amber *draft* that only a human can **Confirm**.
- **Worker-participation evidence** — participation record, meeting minutes, result-sharing confirmation sheet with signature lines, and a postable summary. The vaguest new legal requirement, turned into printable artifacts.
- **Inspection pack** — one Print click produces up to six documents a labor-office inspector expects: the assessment (KRAS-standard layout, signature blocks — missing signatures/dates are the #1 inspection citation), participation minutes, result-sharing confirmation, a postable summary, plus Excel export and JSON backup for the 3-year retention duty.
- **TBM briefing log** — the agent turns confirmed high-risk rows into tomorrow morning's toolbox-meeting script with a signature sheet. One page, two statutory credits: it counts toward mandatory training hours (고시 제2023-63호) and is the daily unit of ongoing risk assessment (고시 제2023-19호).
- **Serious-Accidents-Act semiannual self-check** — a guided walkthrough of the nine management duties in 중대재해처벌법 시행령 제4조 (the dedicated-organization item auto-hides below 500 workers), with evidence notes and a printable check sheet. Checking items off is attestation — human-only, no tool exists.

## Why WebMCP (and not a chatbot or an MCP server)

The tool boundary **is** the legal boundary, and it's enforced *by schema absence*:

| Agent can (tools exist) | Only a human can (no tool exists) |
|---|---|
| Read status, search statutes | Confirm a risk row |
| Set the workplace profile | Record worker participation |
| Draft & edit assessment rows | Check off a duty ("we did the training") |
| Flag rows for human review | Delete rows, sign, set dates |
| Check inspection readiness | **Print / export** (needs a user gesture) |

`human_confirmed` and worker-participation fields simply do not exist in any tool's `inputSchema`. A human-confirmed row is locked: the update tool refuses and tells the agent to ask the person. Every tool returns a `human_action_needed` message citing the statute, so the page itself teaches the agent the division of labor — and both parties watch the same table change in real time.

## WebMCP implementation

Eight tools with a **journey-stage dynamic surface** in [`src/mcp.js`](src/mcp.js): tools register with an `AbortSignal` and the surface is re-synced on every state change, so agents observe the document lifecycle through `toolchange` events. When every row is human-confirmed, participation is recorded and the document is signed, the three assessment write tools **unregister** — the sealed document extends "enforcement by schema absence" from individual fields to the whole pack. Operational tools (like the TBM briefing, which only reads confirmed rows) survive the seal; a human unlocking a row re-registers the write tools.

```js
document.modelContext.registerTool({
  name: "search_regulations",
  description: "Search the bundled Korean safety regulations (산업안전보건법, 중대재해처벌법, 고시 제2024-76호). Use this to cite the exact legal basis for any duty, penalty, or measure.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", minLength: 1, maxLength: 100 },
      limit: { type: "integer", minimum: 1, maximum: 8, default: 5 }
    },
    required: ["query"],
    additionalProperties: false
  },
  annotations: { readOnlyHint: true },
  execute: async ({ query, limit }) => { /* search bundled statutes, mirror results into the UI */ }
});
```

| Tool | Kind | Registered when |
|---|---|---|
| `get_site_status` | read — journey block (goal, step states, `next_action`), duties, rows, participation, readiness | always |
| `search_regulations` | read — results also render in the UI, so human and agent see the same cards | always |
| `set_workplace_profile` | write — rebuilds the duty dashboard live, returns `previous_profile` for undo | always |
| `add_risk_assessment_rows` | write — batch drafts; `imported_from` marks rows extracted from a user's document | profile set ∧ not sealed |
| `update_risk_assessment_row` | write — refuses human-confirmed rows | profile set ∧ not sealed |
| `request_human_review` | write — scroll + highlight + banner on the human's screen | profile set ∧ not sealed |
| `prepare_tbm_briefing` | write — builds the TBM log from *human-confirmed* rows only | confirmed rows exist (survives the seal — operational, never mutates the pack) |
| `check_inspection_readiness` | read — blockers labeled 👤 human-only vs 🤖 agent-fixable | rows exist |

Design details: feature-detect `document.modelContext` with a `navigator.modelContext` fallback; tools registered in the top-level page (ChatGPT ignores iframes); every `execute` is wrapped to emit an on-screen "agent activity" toast and auto-switch to the relevant step; returns are capped and structured to respect the agent's context window. Without WebMCP the site works fully manually.

### Pattern notes (for the WebMCP-curious)

- **Dynamic tool availability** follows Chrome's [best-practices](https://developer.chrome.com/docs/ai/webmcp/best-practices) guidance to register/unregister tools based on page state; the sealed-document transition is observable via `toolchange` and `window.__safeuActiveTools`.
- **`request_human_review`** is a userland take on agent→human elicitation, which the spec itself still leaves unresolved ([webmcp#165](https://github.com/webmachinelearning/webmcp/issues/165)) — the page is the medium: scroll, pulse, banner.
- **Agent drafts / human confirms** is a moderated-writes queue: every agent row lands unconfirmed (amber) and cannot pass inspection readiness until a human confirms it — and confirmed rows lock against agent edits.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

Test with a WebMCP-enabled browser:

- **Google Chrome 149+**: enable `chrome://flags/#enable-webmcp-testing`, then open the site. In DevTools you can inspect tools via `navigator.modelContextTesting.getTools()` (launch Chrome with `--enable-features=WebMCPTesting,DevToolsWebMCPSupport`).
- **ChatGPT desktop app** in-app browser: works out of the box (personal accounts; site tools are unavailable on Enterprise/Edu workspaces).
- Headless QA without WebMCP: the same tool objects are exposed as `window.__safeuTools`.

No backend, no accounts: all state lives in `localStorage` (use **Backup** for the 3-year retention copy).

## Data & licensing

- Statute texts and forms are from **law.go.kr** — Korean statutes carry no copyright (저작권법 제7조). Each regulation card links its source.
- Hazard seed library is modeled on **KOSHA KRAS** industry examples (kosha.or.kr, KOGL).
- Legal facts (fine amounts, dates, thresholds) were verified against primary sources in August 2026; the 2026-02-19 amendment (in force 2026-06-01) is reflected. **safeU is an aid, not legal advice.**
- Code: [MIT](LICENSE).

## Stack

Vite + React, one `xlsx` dependency for Excel export, ~15 source files, static hosting on Netlify. The agent reads user documents (HWP/PDF/XLSX/photos) itself — the page ships zero parsing code.
