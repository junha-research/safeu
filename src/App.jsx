import { useEffect, useState } from 'react'
import { useStore, update, getState, loadData, data, journey } from './store.js'
import { registerWebMCPTools } from './mcp.js'
import { t } from './i18n.js'
import Icon from './Icons.jsx'
import Step1Diagnose from './screens/Dashboard.jsx'
import Step2Draft from './screens/Assessment.jsx'
import Step3Review from './screens/Evidence.jsx'
import Step4Print from './screens/Step4Print.jsx'
import Regulations from './screens/Regulations.jsx'
import PrintPack from './screens/PrintPack.jsx'

const STEPS = [
  ['diagnose', 'step1', 'step1_sub'],
  ['draft', 'step2', 'step2_sub'],
  ['review', 'step3', 'step3_sub'],
  ['print', 'step4', 'step4_sub'],
]

export default function App() {
  const s = useStore()
  const lang = s.lang
  const [mcp, setMcp] = useState({ active: false, count: 0 })
  const [toasts, setToasts] = useState([])
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    loadData()
    setMcp(registerWebMCPTools())
    const pushToast = (text, ms = 4500) => {
      const id = Math.random()
      setToasts((ts) => [...ts, { id, text }])
      setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), ms)
    }
    const onActivity = (e) => {
      pushToast(`🤖 ${e.detail.summary}`)
      setPulse(true)
      setTimeout(() => setPulse(false), 1200)
    }
    const onToast = (e) => pushToast(e.detail.text, 9000)
    const onToolsChanged = (e) => {
      const { count, added, removed, initial } = e.detail
      setMcp({ active: true, count })
      if (initial) return
      const { lang: l } = getState()
      if (removed.length) pushToast(`🔒 ${t(l, 'tools_sealed').replace('{n}', removed.length)}`, 7000)
      else if (added.length) pushToast(`🔓 ${t(l, 'tools_restored').replace('{n}', added.length)}`, 7000)
    }
    window.addEventListener('safeu-agent-activity', onActivity)
    window.addEventListener('safeu-toast', onToast)
    window.addEventListener('safeu-tools-changed', onToolsChanged)
    return () => {
      window.removeEventListener('safeu-agent-activity', onActivity)
      window.removeEventListener('safeu-toast', onToast)
      window.removeEventListener('safeu-tools-changed', onToolsChanged)
    }
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0) // SPA view switch keeps scroll position otherwise
  }, [s.tab])

  const jr = journey(s)
  const currentIdx = STEPS.findIndex(([id]) => id === jr.current)
  const goto = (tab) => update((st) => { st.tab = tab })

  return (
    <>
      <div className="screen-only">
        <header className="topbar">
          <button className="brand" onClick={() => goto('diagnose')}>
            <span className="brand-mark"><Icon name="shield" size={22} /></span>
            <span className="brand-name">safeU</span>
            <span className="brand-tagline">{t(lang, 'tagline')}</span>
          </button>
          <div className="topbar-right">
            <button
              className={'nav-link' + (s.tab === 'regulations' ? ' active' : '')}
              onClick={() => goto('regulations')}
            >
              <Icon name="scale" size={14} /> {t(lang, 'nav_regulations')}
            </button>
            <span className={'agent-badge' + (mcp.active ? ' on' : '') + (pulse ? ' pulse' : '')} title={mcp.active ? '' : t(lang, 'agent_inactive')}>
              <span className="dot" />
              {mcp.active ? `${mcp.count} ${t(lang, 'agent_active')}` : 'WebMCP off'}
            </span>
            <button className="lang-toggle" onClick={() => update((st) => { st.lang = st.lang === 'en' ? 'ko' : 'en' })}>
              {t(lang, 'lang_toggle')}
            </button>
          </div>
        </header>

        {!mcp.active && <div className="mcp-hint">{t(lang, 'agent_inactive')}</div>}

        {s.tab !== 'regulations' && (
          <nav className="stepper" aria-label="progress">
            {STEPS.map(([id, key, subKey], i) => {
              const done = jr.steps[i].done
              const isCurrent = i === currentIdx && !done
              return (
                <button
                  key={id}
                  className={
                    'step' +
                    (s.tab === id ? ' viewing' : '') +
                    (done ? ' done' : '') +
                    (isCurrent ? ' current' : '')
                  }
                  onClick={() => goto(id)}
                >
                  <span className="step-dot">{done ? <Icon name="check" size={14} /> : i + 1}</span>
                  <span className="step-label">
                    <strong>{t(lang, key)}</strong>
                    <small>{t(lang, subKey)}</small>
                  </span>
                  {i < 3 && <span className="step-line" aria-hidden="true" />}
                </button>
              )
            })}
          </nav>
        )}

        <main className="content">
          {!data.loaded ? (
            <div className="loading">Loading regulation data…</div>
          ) : s.tab === 'diagnose' ? (
            <Step1Diagnose />
          ) : s.tab === 'draft' ? (
            <Step2Draft />
          ) : s.tab === 'review' ? (
            <Step3Review />
          ) : s.tab === 'print' ? (
            <Step4Print />
          ) : (
            <Regulations />
          )}
        </main>

        <footer className="footer">{t(lang, 'footer')}</footer>

        <div className="toasts">
          {toasts.map((x) => (
            <div key={x.id} className="toast">{x.text}</div>
          ))}
        </div>
      </div>

      <PrintPack />
    </>
  )
}
