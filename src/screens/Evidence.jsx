// Step 3 · Review & sign — deliberately human-only: row-confirmation status,
// worker participation record, preparer/date. No WebMCP tool writes here.
import { useState } from 'react'
import { useStore, update } from '../store.js'
import { t } from '../i18n.js'
import Icon from '../Icons.jsx'

export default function Step3Review() {
  const s = useStore()
  const lang = s.lang
  const setPart = (patch) => update((st) => Object.assign(st.participation, patch))
  // Local raw text so Enter/newlines survive typing; the store keeps the clean list.
  const [workersRaw, setWorkersRaw] = useState(s.participation.workers.join('\n'))

  const unconfirmed = s.assessment.rows.filter((r) => !r.human_confirmed).length

  return (
    <div className="evidence">
      <div className="step-head">
        <h2>{t(lang, 'review_title')}</h2>
        <p className="sub">{t(lang, 'review_sub')}</p>
      </div>

      <section className={'panel' + (unconfirmed ? ' attention' : ' ok')}>
        <h3><Icon name="check" size={16} /> {t(lang, 'confirm_status_title')}</h3>
        {unconfirmed === 0 ? (
          <p className="status-ok">{t(lang, 'confirm_status_all')}</p>
        ) : (
          <p className="status-open">
            <strong>{unconfirmed}</strong> {t(lang, 'confirm_status_open')}{' '}
            <button className="inline-btn" onClick={() => update((st) => { st.tab = 'draft' })}>
              {t(lang, 'go_confirm')}
            </button>
          </p>
        )}
      </section>

      <section className="panel human-only">
        <h3><Icon name="user" size={16} /> {t(lang, 'participation_title')}</h3>
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
              value={workersRaw}
              onChange={(e) => {
                setWorkersRaw(e.target.value)
                setPart({ workers: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })
              }}
              placeholder={'김철수\n이영희'}
            />
          </label>
          <label className="check wide">
            <input type="checkbox" checked={s.participation.shared} onChange={(e) => setPart({ shared: e.target.checked })} />
            {t(lang, 'part_shared')}
          </label>
        </div>
      </section>

      <section className="panel human-only">
        <h3><Icon name="file" size={16} /> {t(lang, 'sign_title')}</h3>
        <p className="sub">{t(lang, 'sign_sub')}</p>
        <div className="part-form">
          <label>
            {t(lang, 'doc_preparer')}
            <input
              value={s.assessment.preparedBy}
              onChange={(e) => update((st) => { st.assessment.preparedBy = e.target.value })}
              placeholder="홍길동"
            />
          </label>
          <label>
            {t(lang, 'doc_date')}
            <input
              type="date"
              value={s.assessment.date}
              onChange={(e) => update((st) => { st.assessment.date = e.target.value })}
            />
          </label>
        </div>
      </section>

      <div className="next-cta">
        <button className="primary big" onClick={() => update((st) => { st.tab = 'print' })}>
          {t(lang, 'step3_next')}
        </button>
      </div>
    </div>
  )
}
