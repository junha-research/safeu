import React, { useState } from 'react'
import { useStore, update } from '../store.js'
import { t } from '../i18n.js'

const OFFICIAL_FORM_URL = 'https://www.law.go.kr/lsBylInfoPLinkR.do?lsiSeq=267607&lsNm=%EC%82%B0%EC%97%85%EC%95%88%EC%A0%84%EB%B3%B4%EA%B1%B4%EB%B2%95+%EC%8B%9C%ED%96%89%EA%B7%9C%EC%B9%99&bylNo=0030&bylBrNo=00&bylCls=BF'

export default function Evidence() {
  const s = useStore()
  const lang = s.lang
  const [copied, setCopied] = useState(false)
  const setPart = (patch) => update((st) => Object.assign(st.participation, patch))

  return (
    <div className="evidence">
      <section className="panel human-only">
        <h2>{t(lang, 'participation_title')}</h2>
        <p className="sub">{t(lang, 'participation_sub')}</p>
        <div className="part-form">
          <label>
            {t(lang, 'part_mode')}
            <select value={s.participation.mode} onChange={(e) => setPart({ mode: e.target.value })}>
              <option value="meeting">{t(lang, 'mode_meeting')}</option>
              <option value="circulation">{t(lang, 'mode_circulation')}</option>
            </select>
          </label>
          <label>
            {t(lang, 'part_date')}
            <input type="date" value={s.participation.date} onChange={(e) => setPart({ date: e.target.value })} />
          </label>
          <label className="wide">
            {t(lang, 'part_workers')}
            <textarea
              rows={4}
              value={s.participation.workers.join('\n')}
              onChange={(e) => setPart({ workers: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })}
              placeholder={'김철수\n이영희'}
            />
          </label>
          <label className="check wide">
            <input type="checkbox" checked={s.participation.shared} onChange={(e) => setPart({ shared: e.target.checked })} />
            {t(lang, 'part_shared')}
          </label>
        </div>
      </section>

      <section className="panel">
        <h2>{t(lang, 'import_title')}</h2>
        <p className="sub">{t(lang, 'import_sub')}</p>
        <div className="import-formats">{t(lang, 'import_formats')}</div>
        <div className="import-prompt">
          <span>{t(lang, 'import_prompt_label')}</span>
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
      </section>

      <section className="panel">
        <h2>{t(lang, 'accident_title')}</h2>
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

      <section className="panel note">
        <p>{t(lang, 'retention_note')}</p>
      </section>
    </div>
  )
}
