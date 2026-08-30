// Step 4 · Print pack — readiness check, print/export, retention & accident info.
import { useRef } from 'react'
import { useStore, update, computeReadiness } from '../store.js'
import { t } from '../i18n.js'
import Icon from '../Icons.jsx'
import { exportXlsx, exportBackup, importBackup, printInspectionPack } from '../export.js'

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
