import React, { useEffect, useRef } from 'react'
import {
  useStore,
  update,
  data,
  uid,
  riskOf,
  bandOf,
  computeReadiness,
} from '../store.js'
import { t, pick } from '../i18n.js'
import { exportXlsx, exportBackup, importBackup } from '../export.js'

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

export default function Assessment() {
  const s = useStore()
  const lang = s.lang
  const tableRef = useRef(null)
  const fileRef = useRef(null)
  const flaggedIds = s.reviewFlag?.ids || []

  useEffect(() => {
    if (s.reviewFlag && tableRef.current) {
      const el = tableRef.current.querySelector('tr.flagged')
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [s.reviewFlag?.ts])

  const setDoc = (patch) => update((st) => Object.assign(st.assessment, patch))
  const setRow = (id, patch) =>
    update((st) => {
      const r = st.assessment.rows.find((x) => x.id === id)
      if (r) Object.assign(r, patch)
    })

  const addRow = (row = {}) =>
    update((st) => {
      st.assessment.rows.push({
        id: uid(),
        process: '',
        hazard: '',
        cause: '',
        likelihood: 2,
        severity: 2,
        current_controls: '',
        measures: '',
        status: 'open',
        origin: 'human',
        human_confirmed: true, // a human typed it themselves
        ...row,
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
          process: pick(h.process, 'ko'),
          hazard: pick(h.hazard, 'ko'),
          cause: pick(h.cause, 'ko'),
          likelihood: h.likelihood,
          severity: h.severity,
          current_controls: pick(h.current_controls, 'ko'),
          measures: pick(h.measures, 'ko'),
          status: 'open',
          origin: 'library',
          human_confirmed: false,
        })
      }
    })
  }

  const readiness = s.readinessCheckedAt ? computeReadiness(s) : null
  const unconfirmed = s.assessment.rows.filter((r) => !r.human_confirmed).length

  return (
    <div className="assessment">
      {s.reviewFlag && (
        <div className="review-banner">
          <span>
            <strong>{t(lang, 'agent_asks')}:</strong> {s.reviewFlag.note || `${flaggedIds.length} rows`}
          </span>
          <button onClick={() => update((st) => { st.reviewFlag = null })}>{t(lang, 'dismiss')}</button>
        </div>
      )}

      <div className="doc-meta">
        <h2>{t(lang, 'assessment_title')}</h2>
        <span className="method">{t(lang, 'assessment_method')}</span>
        <div className="doc-fields">
          <label>
            {t(lang, 'doc_title')}
            <input value={s.assessment.title} onChange={(e) => setDoc({ title: e.target.value })} placeholder="2026 하반기 위험성평가" />
          </label>
          <label>
            {t(lang, 'doc_date')}
            <input type="date" value={s.assessment.date} onChange={(e) => setDoc({ date: e.target.value })} />
          </label>
          <label>
            {t(lang, 'doc_preparer')}
            <input value={s.assessment.preparedBy} onChange={(e) => setDoc({ preparedBy: e.target.value })} placeholder="홍길동" />
          </label>
        </div>
      </div>

      <div className="toolbar">
        <button onClick={() => addRow()}>{t(lang, 'add_row')}</button>
        <button onClick={seedFromLibrary}>{t(lang, 'seed_library')}</button>
        <button onClick={() => update((st) => { st.readinessCheckedAt = Date.now() })}>{t(lang, 'check_readiness')}</button>
        <span className="spacer" />
        <button onClick={() => exportXlsx(s)}>{t(lang, 'export_xlsx')}</button>
        <button onClick={() => exportBackup(s)}>{t(lang, 'backup_json')}</button>
        <button onClick={() => fileRef.current?.click()}>{t(lang, 'restore_json')}</button>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) importBackup(f, (parsed) => update((st) => Object.assign(st, parsed)))
            e.target.value = ''
          }}
        />
        <button className="primary" onClick={() => window.print()}>{t(lang, 'print_pack')}</button>
      </div>

      {unconfirmed > 0 && (
        <div className="unconfirmed-note">⚠ {unconfirmed} {t(lang, 'review_needed')}</div>
      )}

      {readiness && (
        <div className={'readiness' + (readiness.ready ? ' ok' : '')}>
          <strong>{t(lang, 'readiness_title')}: </strong>
          {readiness.ready ? (
            <span>✅ {t(lang, 'ready_yes')}</span>
          ) : (
            <ul>
              {readiness.blockers.map((b) => (
                <li key={b.code}>
                  <span className={'who-chip ' + b.who}>{t(lang, b.who === 'human' ? 'who_you' : 'who_agent')}</span>{' '}
                  {t(lang, 'R_' + b.code)}
                  {b.rows.length > 0 && <em> ({b.rows.length})</em>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {s.assessment.rows.length === 0 ? (
        <div className="empty-state">{t(lang, 'no_rows')}</div>
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
                          <span className="confirmed-mark">✓ {t(lang, 'confirmed')}</span>
                          {r.origin !== 'human' && (
                            <button className="tiny" onClick={() => setRow(r.id, { human_confirmed: false })}>{t(lang, 'unlock')}</button>
                          )}
                        </>
                      ) : (
                        <button className="confirm-btn" onClick={() => setRow(r.id, { human_confirmed: true })}>{t(lang, 'confirm')}</button>
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
    </div>
  )
}
