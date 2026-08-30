// Step 4 · Print pack — readiness, TBM briefing, SAPA semiannual check,
// print/export, retention & accident info.
import { useRef } from 'react'
import { useStore, update, data, computeReadiness, tbmRows, sapaApplicableIdx } from '../store.js'
import { t, pick } from '../i18n.js'
import Icon from '../Icons.jsx'
import { exportXlsx, exportBackup, importBackup, printInspectionPack } from '../export.js'

function TbmCard({ s, lang }) {
  const rows = tbmRows(s)
  const setTbm = (patch) => update((st) => Object.assign(st.tbm, patch))
  const attendees = s.participation.workers.length
  return (
    <section className="panel">
      <h3><Icon name="check" size={16} /> {t(lang, 'tbm_title')}</h3>
      <p className="sub">{t(lang, 'tbm_sub')}</p>
      {rows.length === 0 ? (
        <p className="status-open">{t(lang, 'tbm_none')}</p>
      ) : (
        <>
          <div className="part-form">
            <label>
              {t(lang, 'tbm_date')}
              <input type="date" value={s.tbm.date} onChange={(e) => setTbm({ date: e.target.value })} />
            </label>
            <label>
              {t(lang, 'tbm_leader')}
              <input value={s.tbm.leader} onChange={(e) => setTbm({ leader: e.target.value })} placeholder="김반장" />
            </label>
          </div>
          <div className="tbm-rows">
            <strong>{t(lang, 'tbm_rows')} ({rows.length})</strong> <small>{t(lang, 'tbm_rows_auto')}</small>
            <ul>
              {rows.map((r) => (
                <li key={r.id}>[{r.process}] {r.hazard}</li>
              ))}
            </ul>
          </div>
          <div className="tbm-badge">
            {t(lang, 'tbm_badge').replace('{n}', attendees || '—')}
          </div>
          <p className="fine-print">
            {s.tbm.date && s.tbm.leader ? `✓ ${t(lang, 'tbm_included')}` : t(lang, 'tbm_missing')} · {t(lang, 'tbm_agent_hint')}
          </p>
        </>
      )}
    </section>
  )
}

function SapaPanel({ s, lang }) {
  const items = data.regulations?.find((r) => r.id === 'sapa-decree-4')?.items || []
  const idxs = sapaApplicableIdx(s)
  const setItem = (i, patch) =>
    update((st) => {
      st.sapaCheck.items[i] = { status: 'none', note: '', ...st.sapaCheck.items[i], ...patch }
      st.sapaCheck.checkedAt = Date.now()
    })
  const raDone = s.assessment.rows.length > 0 && s.assessment.rows.every((r) => r.human_confirmed)
  const doneCount = idxs.filter((i) => s.sapaCheck.items[i]?.status === 'done').length
  return (
    <section className="panel human-only">
      <h3><Icon name="scale" size={16} /> {t(lang, 'sapa_title')} <span className="sapa-progress">{doneCount}/{idxs.length}</span></h3>
      <p className="sub">{t(lang, 'sapa_sub')}</p>
      <label className="sapa-period">
        {t(lang, 'sapa_period')}
        <input
          value={s.sapaCheck.period}
          onChange={(e) => update((st) => { st.sapaCheck.period = e.target.value })}
          placeholder={t(lang, 'sapa_period_ph')}
        />
      </label>
      {raDone && s.sapaCheck.items[2]?.status !== 'done' && (
        <div className="sapa-auto">
          {t(lang, 'sapa_auto3')}{' '}
          <button className="inline-btn" onClick={() => setItem(2, { status: 'done', note: lang === 'ko' ? '위험성평가 실시 (safeU)' : 'Risk assessment done (safeU)' })}>
            {t(lang, 'sapa_apply3')}
          </button>
        </div>
      )}
      <ol className="sapa-list">
        {idxs.map((i) => {
          const it = s.sapaCheck.items[i] || { status: 'none', note: '' }
          return (
            <li key={i} className={'sapa-item ' + it.status}>
              <span className="sapa-no">{i + 1}호</span>
              <span className="sapa-text">{pick(items[i], lang)}</span>
              <select value={it.status} onChange={(e) => setItem(i, { status: e.target.value })}>
                <option value="none">{t(lang, 'sapa_status_none')}</option>
                <option value="partial">{t(lang, 'sapa_status_partial')}</option>
                <option value="done">{t(lang, 'sapa_status_done')}</option>
              </select>
              <input
                className="sapa-note"
                value={it.note}
                onChange={(e) => setItem(i, { note: e.target.value })}
                placeholder={t(lang, 'sapa_note_ph')}
              />
            </li>
          )
        })}
      </ol>
      <p className="fine-print">{t(lang, 'sapa_hidden_note')} · {t(lang, 'sapa_included')}</p>
    </section>
  )
}

const OFFICIAL_FORM_URL = 'https://www.law.go.kr/lsBylInfoPLinkR.do?lsiSeq=267607&lsNm=%EC%82%B0%EC%97%85%EC%95%88%EC%A0%84%EB%B3%B4%EA%B1%B4%EB%B2%95+%EC%8B%9C%ED%96%89%EA%B7%9C%EC%B9%99&bylNo=0030&bylBrNo=00&bylCls=BF'

export default function Step4Print() {
  const s = useStore()
  const lang = s.lang
  const fileRef = useRef(null)
  const readiness = computeReadiness(s)

  return (
    <div className="printstep">
      <div className="step-head">
        <h2>{t(lang, 'print_title')}</h2>
        <p className="sub">{t(lang, 'print_sub')}</p>
      </div>

      <section className={'panel readiness-panel' + (readiness.ready ? ' ok' : ' attention')}>
        <h3>{t(lang, 'readiness_title')}</h3>
        {readiness.ready ? (
          <p className="status-ok"><Icon name="check" size={16} /> {t(lang, 'ready_yes')}</p>
        ) : (
          <ul className="blocker-list">
            {readiness.blockers.map((b) => (
              <li key={b.code}>
                <span className={'who-chip ' + b.who}>
                  <Icon name={b.who === 'human' ? 'user' : 'bot'} size={12} />{' '}
                  {t(lang, b.who === 'human' ? 'who_you' : 'who_agent')}
                </span>{' '}
                {t(lang, 'R_' + b.code)}
                {b.rows.length > 0 && <em> ({b.rows.length})</em>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <TbmCard s={s} lang={lang} />
      <SapaPanel s={s} lang={lang} />

      <div className="print-actions">
        <button
          className="primary big"
          onClick={() =>
            printInspectionPack(() =>
              window.dispatchEvent(new CustomEvent('safeu-toast', { detail: { text: t(lang, 'print_fallback_toast') } }))
            )
          }
        >
          <Icon name="printer" size={17} /> {t(lang, 'print_pack')}
        </button>
        <button onClick={() => exportXlsx(s)}><Icon name="download" size={15} /> {t(lang, 'export_xlsx')}</button>
        <button onClick={() => exportBackup(s)}><Icon name="download" size={15} /> {t(lang, 'backup_json')}</button>
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
      </div>

      <section className="panel note">
        <p>{t(lang, 'retention_note')}</p>
      </section>

      <section className="panel">
        <h3><Icon name="alert" size={16} /> {t(lang, 'accident_title')}</h3>
        <p className="sub">{t(lang, 'accident_sub')}</p>
        <a className="ext-link" href={OFFICIAL_FORM_URL} target="_blank" rel="noreferrer">
          {t(lang, 'accident_link')}
        </a>
        <table className="copy-table">
          <tbody>
            <tr><th>사업장명</th><td>{s.profile?.companyName || '—'}</td></tr>
            <tr><th>업종</th><td>{s.profile?.industry || '—'}</td></tr>
            <tr><th>상시근로자 수</th><td>{s.profile?.workers ?? '—'}</td></tr>
            <tr><th>위험성평가 실시 여부</th><td>{s.assessment.rows.length > 0 ? `실시 (${s.assessment.date || '날짜 미기입'})` : '미실시'}</td></tr>
          </tbody>
        </table>
      </section>
    </div>
  )
}
