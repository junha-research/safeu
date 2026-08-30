// WebMCP tool surface — 7 tools, registered once at page load.
//
// Design contract ("shaped like the law"):
//   Everything the statute lets a manager delegate is agent-callable.
//   Everything the statute requires of HUMANS — confirming rows, recording
//   worker participation, signatures, printing — has NO tool at all.
//   Enforcement is by absence: those fields simply don't exist in any schema.
//   When an agent hits that boundary, the tool's return value tells it what
//   to ask the human to do, and which statute says so.
import {
  getState,
  update,
  data,
  uid,
  riskOf,
  bandOf,
  applicableObligations,
  futureObligations,
  enforcementDate,
  daysUntil,
  computeReadiness,
  BLOCKER_FIX,
  INDUSTRIES,
  journey,
  NEXT_ACTION,
} from './store.js'
import { pick } from './i18n.js'

let registered = false

function activity(tool, summary) {
  window.dispatchEvent(new CustomEvent('safeu-agent-activity', { detail: { tool, summary } }))
}

function switchTab(tab) {
  update((s) => {
    s.tab = tab
  })
}

// Wrap every execute: activity ping + never throw raw errors at the agent.
function wrap(tool, tab, summaryFn) {
  const inner = tool.execute
  tool.execute = async (input) => {
    try {
      const result = await inner(input ?? {})
      activity(tool.name, summaryFn ? summaryFn(input ?? {}, result) : tool.name)
      if (tab) switchTab(tab)
      return result
    } catch (e) {
      return { ok: false, error: String(e?.message || e) }
    }
  }
  return tool
}

function obligationSummary(ob, done) {
  return {
    id: ob.id,
    kind: ob.kind,
    title_en: pick(ob.title, 'en'),
    title_ko: pick(ob.title, 'ko'),
    legal_basis: `${pick(ob.citation?.law, 'ko')} ${ob.citation?.article || ''}`.trim(),
    penalty: ob.penalty ? pick(ob.penalty, 'en') : null,
    note: ob.effectiveNote ? pick(ob.effectiveNote, 'en') : null,
    done_by_human: !!done,
  }
}

function rowSummary(r) {
  const risk = riskOf(r.likelihood, r.severity)
  return {
    id: r.id,
    process: r.process,
    hazard: r.hazard,
    cause: r.cause || '',
    likelihood: r.likelihood,
    severity: r.severity,
    risk,
    risk_label: bandOf(risk),
    current_controls: r.current_controls || '',
    measures: r.measures || '',
    status: r.status,
    origin: r.origin,
    imported_from: r.imported_from || undefined,
    human_confirmed: r.human_confirmed,
  }
}

const TOOLS = [
  wrap(
    {
      name: 'get_site_status',
      description:
        'Get the current safeU state and journey position. The GOAL of this site is a printed, signed, inspection-ready risk-assessment pack — the journey block tells you which of the 4 steps (diagnose → draft → review & sign → print) is next and what to do. Call this first, and again after any human action.',
      annotations: { readOnlyHint: true },
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      async execute() {
        const s = getState()
        const jr = journey(s)
        const journeyInfo = {
          goal: 'An inspection-ready pack (위험성평가표 + worker-participation evidence) the user prints and retains for 3 years.',
          steps: jr.steps.map((st, i) => ({ step: i + 1, id: st.id, done: st.done })),
          current_step: jr.current,
          next_action: NEXT_ACTION[jr.current],
        }
        if (!s.profile) {
          return {
            profile: null,
            journey: journeyInfo,
            hint: 'No workplace profile yet. Ask the user for their industry and regular-employee count, then call set_workplace_profile.',
          }
        }
        const rows = s.assessment.rows
        const readiness = computeReadiness(s)
        return {
          journey: journeyInfo,
          profile: s.profile,
          fine_enforcement_date: enforcementDate(s.profile),
          obligations: applicableObligations(s.profile).map((ob) =>
            obligationSummary(ob, s.obligationsDone[ob.id])
          ),
          risk_assessment: {
            title: s.assessment.title,
            method: 'frequency_severity (1-3 × 1-3, 고시 제2024-76호)',
            date: s.assessment.date || null,
            prepared_by: s.assessment.preparedBy || null,
            rows: rows.slice(0, 30).map(rowSummary),
            rows_truncated: rows.length > 30 ? rows.length - 30 : 0,
            counts: {
              total: rows.length,
              confirmed: rows.filter((r) => r.human_confirmed).length,
              unconfirmed: rows.filter((r) => !r.human_confirmed).length,
            },
          },
          worker_participation: {
            recorded: s.participation.workers.length > 0 && !!s.participation.date,
            shared_with_workers: s.participation.shared,
            note: 'Human-only. Recorded via the Participation panel on the Evidence tab — no tool can write it.',
          },
          inspection_ready: readiness.ready,
        }
      },
    },
    null,
    () => 'read site status'
  ),

  wrap(
    {
      name: 'set_workplace_profile',
      description:
        'Set or update the workplace profile (industry, regular-employee count). This recomputes which Korean legal duties apply. Confirm the values with the user first.',
      inputSchema: {
        type: 'object',
        properties: {
          company_name: { type: 'string', maxLength: 60 },
          industry: { type: 'string', enum: INDUSTRIES },
          workers: { type: 'integer', minimum: 1, maximum: 999 },
        },
        required: ['industry', 'workers'],
        additionalProperties: false,
      },
      async execute(input) {
        const prev = getState().profile
        update((s) => {
          s.profile = {
            companyName: input.company_name || prev?.companyName || '',
            industry: input.industry,
            workers: input.workers,
          }
        })
        const s = getState()
        const obs = applicableObligations(s.profile)
        const enf = enforcementDate(s.profile)
        return {
          ok: true,
          profile: s.profile,
          previous_profile: prev,
          applicable_duties: obs.filter((o) => o.kind === 'duty').length,
          headline_duties: obs
            .filter((o) => o.kind === 'duty')
            .slice(0, 6)
            .map((o) => pick(o.title, 'en')),
          risk_assessment_fine_from: `${enf} (${daysUntil(enf)} days away)`,
          future_duties_when_growing: futureObligations(s.profile).map((o) => pick(o.title, 'en')),
          human_action_needed:
            'The duty checklist on screen has been rebuilt. Checking items off is attestation of real-world fact and must be done by the user.',
        }
      },
    },
    'diagnose',
    (i) => `set profile: ${i.industry}, ${i.workers} workers`
  ),

  wrap(
    {
      name: 'search_regulations',
      description:
        'Search the bundled Korean safety regulations (산업안전보건법, 중대재해처벌법, risk-assessment notice 고시 제2024-76호). Use this to cite the exact legal basis for any duty, penalty, or measure — users distrust uncited claims.',
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', minLength: 1, maxLength: 100 },
          limit: { type: 'integer', minimum: 1, maximum: 8, default: 5 },
        },
        required: ['query'],
        additionalProperties: false,
      },
      async execute({ query, limit = 5 }) {
        if (!data.regulations) return { ok: false, error: 'Regulation data not loaded yet.' }
        const q = query.toLowerCase()
        const terms = q.split(/\s+/).filter(Boolean)
        const scored = data.regulations
          .map((reg) => {
            const hay = [
              pick(reg.article, 'ko'),
              pick(reg.article, 'en'),
              pick(reg.law, 'ko'),
              pick(reg.law, 'en'),
              reg.en || '',
              reg.ko || '',
              ...(reg.tags || []),
            ]
              .join(' ')
              .toLowerCase()
            const score = terms.reduce((n, t2) => n + (hay.includes(t2) ? 1 : 0), 0)
            return { reg, score }
          })
          .filter((x) => x.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)
        update((s) => {
          s.regSearch = { query, ids: scored.map((x) => x.reg.id) }
        })
        return {
          count: scored.length,
          results: scored.map(({ reg }) => ({
            id: reg.id,
            law: pick(reg.law, 'ko'),
            article: pick(reg.article, 'ko'),
            article_en: pick(reg.article, 'en'),
            summary_en: reg.en,
            snippet_ko: (reg.ko || '').slice(0, 300),
            source_url: reg.sourceUrl,
            key_items: reg.items ? reg.items.map((i) => pick(i, 'en')) : undefined,
          })),
          note: 'The same results are now shown on the Regulations tab for the user.',
        }
      },
    },
    'regulations',
    (i, r) => `searched regulations: “${i.query}” (${r.count ?? 0} hits)`
  ),

  wrap(
    {
      name: 'add_risk_assessment_rows',
      description:
        'Add draft rows to the risk assessment table. Rows appear on screen as drafts that a HUMAN must review and confirm — you cannot confirm them. Likelihood and severity are 1–3 (frequency-severity method, 고시 제2024-76호). If the user gives you an existing document (HWP, PDF, Excel, Word, or a photo of a paper form), read it yourself, extract the rows, and pass the file name as imported_from.',
      inputSchema: {
        type: 'object',
        properties: {
          imported_from: {
            type: 'string',
            maxLength: 120,
            description: 'File name, only when rows were extracted from a document the user provided',
          },
          rows: {
            type: 'array',
            minItems: 1,
            maxItems: 15,
            items: {
              type: 'object',
              properties: {
                process: { type: 'string', maxLength: 80, description: 'Work process/task, e.g. 용접 (welding)' },
                hazard: { type: 'string', maxLength: 200, description: '유해·위험요인' },
                cause: { type: 'string', maxLength: 200 },
                likelihood: { type: 'integer', minimum: 1, maximum: 3, description: '빈도: 1=rare 2=occasional 3=frequent' },
                severity: { type: 'integer', minimum: 1, maximum: 3, description: '강도: 1=minor 2=lost-time injury 3=fatal/serious' },
                current_controls: { type: 'string', maxLength: 200 },
                measures: { type: 'string', maxLength: 300, description: 'Concrete risk-reduction measures (감소대책)' },
              },
              required: ['process', 'hazard', 'likelihood', 'severity', 'measures'],
              additionalProperties: false,
            },
          },
        },
        required: ['rows'],
        additionalProperties: false,
      },
      async execute({ rows, imported_from }) {
        const added = []
        update((s) => {
          for (const r of rows) {
            const row = {
              id: uid(),
              process: r.process,
              hazard: r.hazard,
              cause: r.cause || '',
              likelihood: r.likelihood,
              severity: r.severity,
              current_controls: r.current_controls || '',
              measures: r.measures || '',
              status: 'open',
              origin: imported_from ? 'import' : 'agent',
              imported_from: imported_from || undefined,
              human_confirmed: false,
            }
            s.assessment.rows.push(row)
            added.push({ id: row.id, risk: riskOf(row.likelihood, row.severity), risk_label: bandOf(riskOf(row.likelihood, row.severity)) })
          }
        })
        return {
          ok: true,
          added,
          human_action_needed: `${added.length} draft row(s) are highlighted on screen with Confirm buttons. Ask the user to review each row — adjusting ratings if wrong — and click Confirm. Only a human can confirm: worker participation in risk assessment is required by 산업안전보건법 제36조 (2026 amendment, fine up to ₩5,000,000 for excluding workers).`,
        }
      },
    },
    'draft',
    (i) => (i.imported_from ? `imported ${i.rows?.length ?? 0} rows from “${i.imported_from}”` : `drafted ${i.rows?.length ?? 0} risk rows`)
  ),

  wrap(
    {
      name: 'update_risk_assessment_row',
      description:
        'Update fields of an existing DRAFT risk-assessment row by id (e.g. fill in missing measures, re-rate likelihood/severity). Rows already confirmed by a human are locked to you.',
      inputSchema: {
        type: 'object',
        properties: {
          row_id: { type: 'string' },
          process: { type: 'string', maxLength: 80 },
          hazard: { type: 'string', maxLength: 200 },
          cause: { type: 'string', maxLength: 200 },
          likelihood: { type: 'integer', minimum: 1, maximum: 3 },
          severity: { type: 'integer', minimum: 1, maximum: 3 },
          current_controls: { type: 'string', maxLength: 200 },
          measures: { type: 'string', maxLength: 300 },
        },
        required: ['row_id'],
        additionalProperties: false,
      },
      async execute(input) {
        const s = getState()
        const row = s.assessment.rows.find((r) => r.id === input.row_id)
        if (!row) return { ok: false, error: `No row with id ${input.row_id}. Call get_site_status for current ids.` }
        if (row.human_confirmed) {
          return {
            ok: false,
            error: 'row_confirmed_by_human',
            human_action_needed: `Row ${input.row_id} was confirmed by a human and is locked to the agent. Ask the user to click Unlock on that row, or to change it directly themselves.`,
          }
        }
        let updated
        update((st) => {
          const r = st.assessment.rows.find((x) => x.id === input.row_id)
          for (const k of ['process', 'hazard', 'cause', 'likelihood', 'severity', 'current_controls', 'measures']) {
            if (input[k] !== undefined) r[k] = input[k]
          }
          updated = rowSummary(r)
        })
        return { ok: true, row: updated }
      },
    },
    'draft',
    (i) => `updated row ${i.row_id}`
  ),

  wrap(
    {
      name: 'request_human_review',
      description:
        "Flag specific risk-assessment rows for the user's attention on screen (scroll + highlight + banner with your note). Use when drafts are ready for review, or when a task is human-only and you need the person to act.",
      inputSchema: {
        type: 'object',
        properties: {
          row_ids: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 20 },
          note: { type: 'string', maxLength: 200, description: 'Short message shown to the user next to the flagged rows' },
        },
        required: ['row_ids'],
        additionalProperties: false,
      },
      async execute({ row_ids, note }) {
        const valid = getState().assessment.rows.filter((r) => row_ids.includes(r.id)).map((r) => r.id)
        if (!valid.length) return { ok: false, error: 'None of those row ids exist. Call get_site_status first.' }
        update((s) => {
          s.reviewFlag = { ids: valid, note: note || '', ts: Date.now() }
        })
        return {
          ok: true,
          flagged: valid.length,
          human_action_needed:
            'The rows are highlighted on screen with your note. Wait for the user to confirm them, then call check_inspection_readiness.',
        }
      },
    },
    'draft',
    (i) => `asked the user to review ${i.row_ids?.length ?? 0} rows`
  ),

  wrap(
    {
      name: 'check_inspection_readiness',
      description:
        'Check whether the risk-assessment document pack is ready for a labor-office inspection (근로감독). Returns blockers; most require HUMAN action — the return value tells you which, and what to say. Printing/exporting is triggered by the user, not by you.',
      annotations: { readOnlyHint: true },
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      async execute() {
        update((s) => {
          s.readinessCheckedAt = Date.now()
        })
        const s = getState()
        const { ready, blockers } = computeReadiness(s)
        if (ready) {
          return {
            ready: true,
            human_action_needed:
              'Everything checks out. Tell the user to click “Print inspection pack” — printing requires a user gesture and is human-only. Remind them to keep records for 3 years.',
          }
        }
        const humanCount = blockers.filter((b) => b.who === 'human').length
        return {
          ready: false,
          blockers: blockers.map((b) => ({ code: b.code, owner: b.who, rows: b.rows, fix: BLOCKER_FIX[b.code] })),
          human_action_needed: `${humanCount} of ${blockers.length} blockers are human-only. Summarize them for the user, offer to fix the agent-fixable ones yourself, and use request_human_review to point at specific rows.`,
        }
      },
    },
    'print',
    (i, r) => (r.ready ? 'readiness check: READY ✅' : `readiness check: ${r.blockers?.length ?? 0} blockers`)
  ),
]

// Debug/testing surface: lets DevTools (and headless QA) exercise the exact
// tool code paths even without a WebMCP-enabled browser.
if (typeof window !== 'undefined') window.__safeuTools = TOOLS

export function registerWebMCPTools() {
  if (registered) return { active: true, count: TOOLS.length }
  const mc =
    typeof document !== 'undefined' && typeof document.modelContext?.registerTool === 'function'
      ? document.modelContext
      : typeof navigator !== 'undefined' && typeof navigator.modelContext?.registerTool === 'function'
        ? navigator.modelContext // deprecated alias kept for older Chrome builds
        : null
  if (!mc) return { active: false, count: 0 }
  for (const tool of TOOLS) {
    try {
      mc.registerTool(tool)
    } catch (e) {
      console.warn('WebMCP registerTool failed:', tool.name, e)
    }
  }
  registered = true
  return { active: true, count: TOOLS.length }
}
