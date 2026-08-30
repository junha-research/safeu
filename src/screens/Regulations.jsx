import { useState } from 'react'
import { useStore, update, data } from '../store.js'
import { t, pick } from '../i18n.js'

export default function Regulations() {
  const s = useStore()
  const lang = s.lang
  const [query, setQuery] = useState('')
  const regs = data.regulations || []

  const agentIds = s.regSearch?.ids
  const q = query.trim().toLowerCase()
  let shown = regs
  if (q) {
    shown = regs.filter((r) =>
      [pick(r.article, 'ko'), pick(r.article, 'en'), pick(r.law, 'ko'), pick(r.law, 'en'), r.en || '', r.ko || '', ...(r.tags || [])]
        .join(' ')
        .toLowerCase()
        .includes(q)
    )
  } else if (agentIds?.length) {
    const rank = new Map(agentIds.map((id, i) => [id, i]))
    shown = [...regs].sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99))
  }

  return (
    <div className="regulations">
      <button className="inline-btn back-link" onClick={() => update((st) => { st.tab = 'diagnose' })}>
        {t(lang, 'back_to_journey')}
      </button>
      <h2>{t(lang, 'reg_title')}</h2>
      <p className="sub">{t(lang, 'reg_sub')}</p>
      <input
        className="reg-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t(lang, 'reg_search')}
      />
      {!q && s.regSearch && (
        <div className="agent-searched">
          {t(lang, 'agent_searched')}: “{s.regSearch.query}”
        </div>
      )}
      <div className="reg-list">
        {shown.map((r) => (
          <article key={r.id} className={'reg-card' + (agentIds?.includes(r.id) && !q ? ' hit' : '')}>
            <header>
              <strong>{pick(r.article, lang)}</strong>
              <span className="law-chip">{pick(r.law, lang)}</span>
            </header>
            <p className="reg-en">{r.en}</p>
            {r.items && (
              <ol className="reg-items">
                {r.items.map((it, i) => (
                  <li key={i}>{pick(it, lang)}</li>
                ))}
              </ol>
            )}
            <details>
              <summary>{t(lang, 'reg_original')}</summary>
              <pre className="reg-ko">{r.ko}</pre>
            </details>
            <a className="ext-link" href={r.sourceUrl} target="_blank" rel="noreferrer">
              {t(lang, 'reg_source')}: law.go.kr →
            </a>
          </article>
        ))}
      </div>
    </div>
  )
}
