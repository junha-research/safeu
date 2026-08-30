// Step 2 · Draft — the collaborative risk-assessment table. Agent drafts land
// amber; humans confirm (or edit) them. Printing/signing live in later steps.
import { useEffect, useRef, useState } from 'react'
import { useStore, update, data, uid, riskOf, bandOf } from '../store.js'
import { t, pick } from '../i18n.js'
import Icon from '../Icons.jsx'

const ORIGIN_BADGE = { agent: 'badge_agent', import: 'badge_import', library: 'badge_library' }

function RiskChip({ l, s: sev, lang }) {
  const risk = riskOf(l, sev)
  const band = bandOf(risk)
  return (
    <span className={'risk-chip ' + band}>
      {risk} · {t(lang, 'risk_' + band)}
    </span>
  )
}

function ImportGuide({ lang }) {
  const [copied, setCopied] = useState(false)
  return (
    <aside className="import-guide">
      <h4><Icon name="file" size={15} /> {t(lang, 'import_title')}</h4>
      <p>{t(lang, 'import_sub')}</p>
      <div className="import-formats">{t(lang, 'import_formats')}</div>
      <div className="import-prompt">
        <code>“{t(lang, 'import_prompt')}”</code>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(t(lang, 'import_prompt'))
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
        >
          {copied ? t(lang, 'copied') : t(lang, 'copy')}
        </button>
      </div>
      <p className="fine-print">{t(lang, 'import_fallback')}</p>
    </aside>
  )
}

export default function Step2Draft() {
  const s = useStore()
  const lang = s.lang
  const tableRef = useRef(null)
  const flaggedIds = s.reviewFlag?.ids || []

  useEffect(() => {
    if (s.reviewFlag && tableRef.current) {
      const el = tableRef.current.querySelector('tr.flagged')
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [s.reviewFlag?.ts])

  const setRow = (id, patch) =>
    update((st) => {
      const r = st.assessment.rows.find((x) => x.id === id)
      if (r) Object.assign(r, patch)
    })

  const addRow = () =>
    update((st) => {
      st.assessment.rows.push({
        id: uid(),
        process: '', hazard: '', cause: '',
        likelihood: 2, severity: 2,
        current_controls: '', measures: '',
        status: 'open', origin: 'human',
        human_confirmed: true, // a human typed it themselves
      })
    })

  const seedFromLibrary = () => {
    const industry = s.profile?.industry
    const seeds = (data.hazards || []).filter((h) => h.industry === industry).slice(0, 12)
    if (!seeds.length) {
      alert(lang === 'ko' ? '이 업종의 예시가 아직 없습니다 — 에이전트에게 초안을 요청해 보세요.' : 'No seed library for this industry yet — ask your agent to draft instead.')
      return
    }
    update((st) => {
      for (const h of seeds) {
        st.assessment.rows.push({
          id: uid(),
          process: pick(h.process, 'ko'), hazard: pick(h.hazard, 'ko'), cause: pick(h.cause, 'ko'),
          likelihood: h.likelihood, severity: h.severity,
          current_controls: pick(h.current_controls, 'ko'), measures: pick(h.measures, 'ko'),
          status: 'open', origin: 'library', human_confirmed: false,
        })
      }
    })
  }

  const unconfirmed = s.assessment.rows.filter((r) => !r.human_confirmed).length

  return (
    <div className="assessment">
      {s.reviewFlag && (
        <div className="review-banner">
          <span>
            <Icon name="bot" size={15} /> <strong>{t(lang, 'agent_asks')}:</strong>{' '}
            {s.reviewFlag.note || `${flaggedIds.length} rows`}
          </span>
          <button onClick={() => update((st) => { st.reviewFlag = null })}>{t(lang, 'dismiss')}</button>
        </div>
      )}

      <div className="step-head">
        <h2>{t(lang, 'draft_title')}</h2>
        <p className="sub">{t(lang, 'draft_sub')}</p>
      </div>

      <div className="draft-layout">
        <div className="draft-main">
          <div className="toolbar">
            <label className="title-field">
              {t(lang, 'doc_title')}
              <input
                value={s.assessment.title}
                onChange={(e) => update((st) => { st.assessment.title = e.target.value })}
                placeholder="2026 하반기 위험성평가"
              />
            </label>
            <span className="spacer" />
            <button onClick={addRow}>+ {t(lang, 'add_row')}</button>
            <button onClick={seedFromLibrary}>{t(lang, 'seed_library')}</button>
          </div>

          {unconfirmed > 0 && (
            <div className="unconfirmed-note"><Icon name="alert" size={14} /> {unconfirmed} {t(lang, 'review_needed')}</div>
          )}

          {s.assessment.rows.length === 0 ? (
            <div className="empty-state">
              <h3>{t(lang, 'no_rows_title')}</h3>
              <ol className="start-ways">
                <li><Icon name="bot" size={16} /> {t(lang, 'no_rows_agent')}</li>
                <li>
                  <Icon name="file" size={16} /> {t(lang, 'no_rows_import')} <code>“{t(lang, 'import_prompt')}”</code>
                </li>
                <li>
                  <Icon name="user" size={16} /> {t(lang, 'no_rows_manual')}{' '}
                  <button className="inline-btn" onClick={addRow}>+ {t(lang, 'add_row')}</button>{' '}
                  <button className="inline-btn" onClick={seedFromLibrary}>{t(lang, 'seed_library')}</button>
                </li>
              </ol>
            </div>
          ) : (
            <div className="table-wrap" ref={tableRef}>
              <table className="risk-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t(lang, 'col_process')}</th>
                    <th>{t(lang, 'col_hazard')} / {t(lang, 'col_cause')}</th>
                    <th>{t(lang, 'col_l')}</th>
                    <th>{t(lang, 'col_s')}</th>
                    <th>{t(lang, 'col_risk')}</th>
                    <th>{t(lang, 'col_controls')} → {t(lang, 'col_measures')}</th>
                    <th>{t(lang, 'col_status')}</th>
                    <th>{t(lang, 'col_review')}</th>
                  </tr>
                </thead>
                <tbody>
                  {s.assessment.rows.map((r, i) => {
                    const locked = r.human_confirmed
                    return (
                      <tr key={r.id} className={(flaggedIds.includes(r.id) ? 'flagged ' : '') + (locked ? 'locked' : 'draft')}>
                        <td className="num">{i + 1}</td>
                        <td>
                          <input value={r.process} onChange={(e) => setRow(r.id, { process: e.target.value })} />
                          {r.origin !== 'human' && (
                            <span className={'origin-badge ' + r.origin}>
                              {t(lang, ORIGIN_BADGE[r.origin])}
                              {r.imported_from ? `: ${r.imported_from}` : ''}
                            </span>
                          )}
                        </td>
                        <td>
                          <input value={r.hazard} onChange={(e) => setRow(r.id, { hazard: e.target.value })} placeholder={t(lang, 'col_hazard')} />
                          <input className="dim" value={r.cause} onChange={(e) => setRow(r.id, { cause: e.target.value })} placeholder={t(lang, 'col_cause')} />
                        </td>
                        <td>
                          <select value={r.likelihood} onChange={(e) => setRow(r.id, { likelihood: Number(e.target.value) })}>
                            {[1, 2, 3].map((n) => <option key={n}>{n}</option>)}
                          </select>
                        </td>
                        <td>
                          <select value={r.severity} onChange={(e) => setRow(r.id, { severity: Number(e.target.value) })}>
                            {[1, 2, 3].map((n) => <option key={n}>{n}</option>)}
                          </select>
                        </td>
                        <td><RiskChip l={r.likelihood} s={r.severity} lang={lang} /></td>
                        <td>
                          <input className="dim" value={r.current_controls} onChange={(e) => setRow(r.id, { current_controls: e.target.value })} placeholder={t(lang, 'col_controls')} />
                          <input value={r.measures} onChange={(e) => setRow(r.id, { measures: e.target.value })} placeholder={t(lang, 'col_measures')} />
                        </td>
                        <td>
                          <select value={r.status} onChange={(e) => setRow(r.id, { status: e.target.value })}>
                            <option value="open">{t(lang, 'status_open')}</option>
                            <option value="progress">{t(lang, 'status_progress')}</option>
                            <option value="done">{t(lang, 'status_done')}</option>
                          </select>
                        </td>
                        <td className="row-actions">
                          {locked ? (
                            <>
                              <span className="confirmed-mark"><Icon name="check" size={13} /> {t(lang, 'confirmed')}</span>
                              {r.origin !== 'human' && (
                                <button className="tiny" onClick={() => setRow(r.id, { human_confirmed: false })}>{t(lang, 'unlock')}</button>
                              )}
                            </>
                          ) : (
                            <button className="confirm-btn" onClick={() => setRow(r.id, { human_confirmed: true })}>
                              <Icon name="check" size={13} /> {t(lang, 'confirm')}
                            </button>
                          )}
                          <button
                            className="tiny danger"
                            onClick={() => update((st) => { st.assessment.rows = st.assessment.rows.filter((x) => x.id !== r.id) })}
                          >
                            {t(lang, 'delete_row')}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="legend">{t(lang, 'legend')}</div>

          {s.assessment.rows.length > 0 && (
            <div className="next-cta">
              <button className="primary big" onClick={() => update((st) => { st.tab = 'review' })}>
                {t(lang, 'step2_next')}
              </button>
            </div>
          )}
        </div>

        <ImportGuide lang={lang} />
      </div>
    </div>
  )
}
