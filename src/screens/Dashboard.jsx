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
import { t, pick, formatArticle } from '../i18n.js'
import Icon from '../Icons.jsx'

// Duties this app actively solves, and the step that solves them.
const SOLVED = {
  'risk-assessment': 'draft', // → step 2 draft
  'safety-education-regular': 'print', // → step 4 TBM (counts toward training hours)
  'sapa-management-system': 'print', // → step 4 SAPA semiannual check
  'accident-report': 'print', // → step 4 accident panel
}
const SOLVED_ORDER = Object.keys(SOLVED)

function DutyCard({ ob, lang, done, onToggle, reference }) {
  const kindLabel = ob.kind === 'duty' ? 'legal_duty' : ob.kind === 'incentive' ? 'incentive' : 'recommended'
  const solveTab = SOLVED[ob.id]
  return (
    <div className={'duty-card' + (done ? ' done' : '') + (ob.kind === 'incentive' ? ' incentive' : '') + (solveTab ? ' solved' : '')}>
      <div className="duty-head">
        <span className={'kind-chip ' + (reference ? 'reference' : ob.kind)}>
          {t(lang, reference ? 'reference_chip' : kindLabel)}
        </span>
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
          § {pick(ob.citation?.law, lang)} {formatArticle(ob.citation?.article, lang)}
        </span>
        {ob.penalty && <span className="penalty-chip"><Icon name="alert" size={12} /> {pick(ob.penalty, lang)}</span>}
        {ob.effectiveNote && <span className="note-chip">{pick(ob.effectiveNote, lang)}</span>}
      </div>
      {solveTab && !reference && (
        <button className="solve-cta" onClick={() => update((st) => { st.tab = solveTab })}>
          {t(lang, 'solve_cta')}
        </button>
      )}
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

          <h3 className="section-title">{t(lang, 'solved_here')}</h3>
          <div className="duty-grid">
            {duties
              .filter((ob) => SOLVED[ob.id])
              .sort((a, b) => SOLVED_ORDER.indexOf(a.id) - SOLVED_ORDER.indexOf(b.id))
              .map((ob) => (
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

          <details className="duties-ref">
            <summary>
              {t(lang, 'reference_duties').replace('{n}', duties.filter((ob) => !SOLVED[ob.id]).length)}
            </summary>
            <div className="duty-grid">
              {duties
                .filter((ob) => !SOLVED[ob.id])
                .map((ob) => (
                  <DutyCard
                    key={ob.id}
                    ob={ob}
                    lang={lang}
                    reference
                    done={s.obligationsDone[ob.id]}
                    onToggle={() => update((st) => { st.obligationsDone[ob.id] = !st.obligationsDone[ob.id] })}
                  />
                ))}
            </div>
          </details>

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
                      § {pick(ob.citation?.law, lang)} {formatArticle(ob.citation?.article, lang)} · ≥
                      {ob.applies?.minWorkers}
                      {lang === 'ko' ? '인' : ' workers'}
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
