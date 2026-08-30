// Step 1 · Diagnose — hero (first visit) + 3-question triage + legal duty list.
import {
  useStore,
  update,
  data,
  applicableObligations,
  futureObligations,
  enforcementDate,
  daysUntil,
} from '../store.js'
import { t, pick } from '../i18n.js'
import Icon from '../Icons.jsx'

function DutyCard({ ob, lang, done, onToggle }) {
  const kindLabel = ob.kind === 'duty' ? 'legal_duty' : ob.kind === 'incentive' ? 'incentive' : 'recommended'
  return (
    <div className={'duty-card' + (done ? ' done' : '') + (ob.kind === 'incentive' ? ' incentive' : '')}>
      <div className="duty-head">
        <span className={'kind-chip ' + ob.kind}>{t(lang, kindLabel)}</span>
        <strong>{pick(ob.title, lang)}</strong>
        {ob.kind === 'duty' && (
          <label className="done-check">
            <input type="checkbox" checked={!!done} onChange={onToggle} /> {t(lang, 'duty_done')}
          </label>
        )}
      </div>
      <p className="duty-detail">{pick(ob.detail, lang)}</p>
      <div className="duty-meta">
        <span className="cite-chip" title={t(lang, 'citation')}>
          § {pick(ob.citation?.law, 'ko')} {ob.citation?.article}
        </span>
        {ob.penalty && <span className="penalty-chip"><Icon name="alert" size={12} /> {pick(ob.penalty, lang)}</span>}
        {ob.effectiveNote && <span className="note-chip">{pick(ob.effectiveNote, lang)}</span>}
      </div>
    </div>
  )
}

export default function Step1Diagnose() {
  const s = useStore()
  const lang = s.lang
  const industries = data.obligations?.industries || []

  const setProfile = (patch) =>
    update((st) => {
      st.profile = { companyName: '', industry: industries[0]?.id || 'manufacturing_metal', workers: 10, ...st.profile, ...patch }
    })

  const obs = applicableObligations(s.profile)
  const duties = obs.filter((o) => o.kind === 'duty')
  const incentives = obs.filter((o) => o.kind !== 'duty')
  const future = futureObligations(s.profile)
  const enf = s.profile ? enforcementDate(s.profile) : null

  return (
    <div className="dashboard">
      {!s.profile && (
        <section className="hero">
          <span className="hero-kicker">{t(lang, 'hero_kicker')}</span>
          <h1>{t(lang, 'hero_title')}</h1>
          <p className="hero-sub">{t(lang, 'hero_sub')}</p>
          <div className="hero-how">
            <h3>{t(lang, 'hero_how')}</h3>
            <ol>
              {[1, 2, 3, 4].map((n) => (
                <li key={n}>
                  <span className="how-n">{n}</span>
                  {t(lang, 'hero_how' + n)}
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      <section className="profile-card">
        <h2>{t(lang, 'setup_title')}</h2>
        <p className="sub">{t(lang, 'setup_sub')}</p>
        <div className="profile-form">
          <label>
            {t(lang, 'company_name')}
            <input
              value={s.profile?.companyName || ''}
              onChange={(e) => setProfile({ companyName: e.target.value })}
              placeholder="㈜safeU"
            />
          </label>
          <label>
            {t(lang, 'industry')}
            <select value={s.profile?.industry || ''} onChange={(e) => setProfile({ industry: e.target.value })}>
              <option value="" disabled>—</option>
              {industries.map((ind) => (
                <option key={ind.id} value={ind.id}>{pick(ind, lang)}</option>
              ))}
            </select>
          </label>
          <label>
            {t(lang, 'workers')}
            <input
              type="number"
              min="1"
              max="999"
              value={s.profile?.workers ?? ''}
              onChange={(e) => setProfile({ workers: Math.max(1, Number(e.target.value) || 1) })}
            />
          </label>
        </div>
        <div className="agent-hint">
          <Icon name="bot" size={15} /> {t(lang, 'hero_agent_hint')}
        </div>
      </section>

      {s.profile && (
        <>
          {enf && daysUntil(enf) > 0 && (
            <div className="countdown">
              <strong>D-{daysUntil(enf)}</strong> {enf} — {t(lang, 'countdown')}
            </div>
          )}

          <h3 className="section-title">{t(lang, 'duties_now')} ({duties.length})</h3>
          <div className="duty-grid">
            {duties.map((ob) => (
              <DutyCard
                key={ob.id}
                ob={ob}
                lang={lang}
                done={s.obligationsDone[ob.id]}
                onToggle={() => update((st) => { st.obligationsDone[ob.id] = !st.obligationsDone[ob.id] })}
              />
            ))}
          </div>

          <div className="next-cta">
            <p>{t(lang, 'step1_next_hint')}</p>
            <button className="primary big" onClick={() => update((st) => { st.tab = 'draft' })}>
              {t(lang, 'step1_next')}
            </button>
          </div>

          {incentives.length > 0 && (
            <>
              <h3 className="section-title">{t(lang, 'duties_incentive')}</h3>
              <div className="duty-grid">
                {incentives.map((ob) => (
                  <DutyCard key={ob.id} ob={ob} lang={lang} done={false} onToggle={() => {}} />
                ))}
              </div>
            </>
          )}

          {future.length > 0 && (
            <>
              <h3 className="section-title muted">{t(lang, 'duties_future')}</h3>
              <div className="duty-grid future">
                {future.map((ob) => (
                  <div key={ob.id} className="duty-card ghost">
                    <strong>{pick(ob.title, lang)}</strong>
                    <span className="cite-chip">
                      § {pick(ob.citation?.law, 'ko')} {ob.citation?.article} · ≥{ob.applies?.minWorkers}인
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
