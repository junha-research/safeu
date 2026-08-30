// Single localStorage-backed store. Both the UI and the WebMCP tools mutate
// state through update() — agent actions and human actions share one code path.
import { useSyncExternalStore } from 'react'

const KEY = 'safeu:v1'

export const INDUSTRIES = [
  'manufacturing_metal',
  'manufacturing_food',
  'manufacturing_chemical',
  'construction',
  'logistics_warehouse',
  'wholesale_retail',
  'restaurant',
  'other_service',
]

function defaultState() {
  return {
    lang: 'en',
    tab: 'diagnose',
    profile: null, // { companyName, industry, workers }
    obligationsDone: {}, // id -> true (human attestation only)
    assessment: {
      title: '',
      method: 'frequency_severity',
      date: '',
      preparedBy: '',
      rows: [],
    },
    participation: { mode: 'meeting', workers: [], date: '', shared: false },
    tbm: { date: '', leader: '', rowIds: [] }, // toolbox-meeting briefing (5th print doc)
    sapaCheck: { period: '', items: {}, checkedAt: null }, // 중처법 시행령 제4조 반기 점검 (human-only attestation)
    reviewFlag: null, // { ids, note, ts } set by agent via request_human_review
    regSearch: null, // { query, ids } mirrored to the Regulations screen
    readinessCheckedAt: null,
  }
}

const VIEWS = ['diagnose', 'draft', 'review', 'print', 'regulations']

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s = { ...defaultState(), ...JSON.parse(raw) }
      if (!VIEWS.includes(s.tab)) s.tab = 'diagnose' // migrate pre-journey tab ids
      return s
    }
  } catch {
    /* corrupted or unavailable storage — start fresh */
  }
  return defaultState()
}

let state = load()
const listeners = new Set()

export function getState() {
  return state
}

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// updater receives a deep clone and mutates it freely.
export function update(updater) {
  const next = structuredClone(state)
  updater(next)
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* private mode etc. — app still works in-memory */
  }
  listeners.forEach((fn) => fn())
}

export function useStore() {
  return useSyncExternalStore(subscribe, getState)
}

export function resetAll() {
  state = defaultState()
  try {
    localStorage.removeItem(KEY)
  } catch {}
  listeners.forEach((fn) => fn())
}

// ---------- static data (bundled JSON, fetched once) ----------
export const data = { obligations: null, regulations: null, hazards: null, loaded: false }

export async function loadData() {
  const [ob, reg, hz] = await Promise.all(
    ['obligations', 'regulations', 'hazards'].map((n) =>
      fetch(`/data/${n}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    )
  )
  data.obligations = ob
  data.regulations = reg
  data.hazards = hz
  data.loaded = true
  update(() => {}) // bump identity so subscribers re-render
}

// ---------- domain helpers ----------
export const riskOf = (l, s) => l * s
export const bandOf = (risk) => (risk <= 2 ? 'low' : risk <= 4 ? 'medium' : 'high')

export const uid = () => 'r' + Math.random().toString(36).slice(2, 8)

export function appliesTo(ob, profile) {
  if (!profile) return false
  const a = ob.applies || {}
  if (a.minWorkers != null && profile.workers < a.minWorkers) return false
  if (a.maxWorkers != null && profile.workers > a.maxWorkers) return false
  if (a.industries && a.industries !== 'all' && !a.industries.includes(profile.industry)) return false
  if (a.constructionOnly && profile.industry !== 'construction') return false
  return true
}

// Duties that will apply once the workplace grows past a headcount threshold.
export function futureObligations(profile) {
  if (!data.obligations || !profile) return []
  return data.obligations.obligations.filter(
    (ob) =>
      ob.kind === 'duty' &&
      !appliesTo(ob, profile) &&
      ob.applies?.minWorkers != null &&
      ob.applies.minWorkers > profile.workers &&
      (!ob.applies.industries ||
        ob.applies.industries === 'all' ||
        ob.applies.industries.includes(profile.industry))
  )
}

export function applicableObligations(profile) {
  if (!data.obligations || !profile) return []
  return data.obligations.obligations.filter((ob) => appliesTo(ob, profile))
}

// Fine enforcement date for risk-assessment 과태료 by workplace size.
export function enforcementDate(profile) {
  if (!profile) return null
  return profile.workers >= 50 ? '2027-01-01' : '2028-01-01'
}

export function daysUntil(dateStr) {
  return Math.ceil((new Date(dateStr) - Date.now()) / 86400000)
}

// TBM briefing rows: explicit selection, else confirmed high-risk rows, else confirmed rows. Cap 8.
export function tbmRows(s) {
  const rows = s.assessment.rows
  if (s.tbm.rowIds.length) return rows.filter((r) => s.tbm.rowIds.includes(r.id)).slice(0, 8)
  const confirmed = rows.filter((r) => r.human_confirmed)
  const high = confirmed.filter((r) => riskOf(r.likelihood, r.severity) >= 6)
  return (high.length ? high : confirmed).slice(0, 8)
}

// 중처법 시행령 제4조 items applicable to this workplace (item idx 1 = 전담조직, 500인+ only).
export function sapaApplicableIdx(s) {
  const all = data.regulations?.find((r) => r.id === 'sapa-decree-4')?.items || []
  return all.map((_, i) => i).filter((i) => i !== 1 || (s.profile?.workers ?? 0) >= 500)
}

// ---------- journey (the single goal the UI and the agent both drive toward) ----------
// Goal: an inspection-ready pack (위험성평가표 + 근로자 참여 증빙) printed and retained.
export function journey(s) {
  const rows = s.assessment.rows
  const steps = [
    { id: 'diagnose', done: !!s.profile },
    { id: 'draft', done: rows.length > 0 },
    {
      id: 'review',
      done:
        rows.length > 0 &&
        rows.every((r) => r.human_confirmed) &&
        s.participation.workers.length > 0 &&
        !!s.participation.date &&
        s.participation.shared &&
        !!s.assessment.preparedBy &&
        !!s.assessment.date,
    },
    { id: 'print', done: computeReadiness(s).ready },
  ]
  const current = steps.find((st) => !st.done)?.id || 'print'
  return { steps, current }
}

export const NEXT_ACTION = {
  diagnose:
    'Ask the user for their industry and regular-employee count, then call set_workplace_profile. This computes their legal duties.',
  draft:
    'Draft risk-assessment rows with add_risk_assessment_rows — interview the user about their work processes, or read a document they provide (HWP/PDF/Excel/photo).',
  review:
    'Human-only stage: the user must Confirm each row (step 2 table), record worker participation and sign (step 3 on screen). Use request_human_review to point at rows, then wait.',
  print:
    'Call check_inspection_readiness; when ready, tell the user to click Print on step 4. Printing is human-only.',
}

// ---------- inspection readiness (shared by the tool and the UI panel) ----------
export function computeReadiness(s) {
  const blockers = []
  const rows = s.assessment.rows
  if (!s.profile) {
    blockers.push({ code: 'NO_PROFILE', who: 'agent', rows: [] })
  }
  if (rows.length === 0) {
    blockers.push({ code: 'NO_ROWS', who: 'agent', rows: [] })
  }
  const unconfirmed = rows.filter((r) => !r.human_confirmed).map((r) => r.id)
  if (unconfirmed.length) blockers.push({ code: 'UNCONFIRMED_ROWS', who: 'human', rows: unconfirmed })
  const highNoMeasure = rows
    .filter((r) => riskOf(r.likelihood, r.severity) >= 6 && !(r.measures || '').trim())
    .map((r) => r.id)
  if (highNoMeasure.length) blockers.push({ code: 'HIGH_RISK_NO_MEASURES', who: 'agent', rows: highNoMeasure })
  if (!s.participation.workers.length || !s.participation.date)
    blockers.push({ code: 'NO_WORKER_PARTICIPATION', who: 'human', rows: [] })
  if (!s.participation.shared) blockers.push({ code: 'RESULT_NOT_SHARED', who: 'human', rows: [] })
  if (!s.assessment.preparedBy || !s.assessment.date)
    blockers.push({ code: 'NO_PREPARER_OR_DATE', who: 'human', rows: [] })
  return { ready: blockers.length === 0, blockers }
}

// Human-readable fix instructions per blocker code (returned to the agent).
export const BLOCKER_FIX = {
  NO_PROFILE: 'AGENT: ask the user for industry and employee count, then call set_workplace_profile.',
  NO_ROWS: 'AGENT: you can fix this — interview the user about their work processes (or read a document they provide) and call add_risk_assessment_rows.',
  UNCONFIRMED_ROWS:
    'HUMAN: the user must review each highlighted row (adjust ratings if wrong) and click Confirm in the step 2 table. Only a human can confirm — worker participation in risk assessment is required by OSH Act Art. 36 (산업안전보건법 제36조, 2026 amendment).',
  HIGH_RISK_NO_MEASURES: 'AGENT: you can fix this — add concrete reduction measures via update_risk_assessment_row.',
  NO_WORKER_PARTICIPATION:
    'HUMAN: the user must record participating workers (names, date, meeting or circulation) on step 3 (Review & sign). An agent cannot legally substitute for worker participation.',
  RESULT_NOT_SHARED:
    'HUMAN: the user must actually share/post the results to workers and check the "results shared" box on step 3. Failing to share results carries a fine of up to 5,000,000 KRW.',
  NO_PREPARER_OR_DATE:
    'HUMAN: the user must enter the preparer name and assessment date on step 3 (Review & sign). Missing signatures/dates are the #1 inspection citation.',
}
