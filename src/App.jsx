import React, { useEffect, useState } from 'react'
import { useStore, update, loadData, data } from './store.js'
import { registerWebMCPTools } from './mcp.js'
import { t } from './i18n.js'
import Dashboard from './screens/Dashboard.jsx'
import Assessment from './screens/Assessment.jsx'
import Evidence from './screens/Evidence.jsx'
import Regulations from './screens/Regulations.jsx'
import PrintPack from './screens/PrintPack.jsx'

const TABS = [
  ['dashboard', 'tab_dashboard'],
  ['assessment', 'tab_assessment'],
  ['evidence', 'tab_evidence'],
  ['regulations', 'tab_regulations'],
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
    const onActivity = (e) => {
      const { summary } = e.detail
      const id = Math.random()
      setToasts((ts) => [...ts, { id, text: `🤖 ${summary}` }])
      setPulse(true)
      setTimeout(() => setPulse(false), 1200)
      setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 4500)
    }
    window.addEventListener('safeu-agent-activity', onActivity)
    return () => window.removeEventListener('safeu-agent-activity', onActivity)
  }, [])

  return (
    <>
      <div className="screen-only">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">🦺</span>
            <span className="brand-name">safeU</span>
            <span className="brand-tagline">{t(lang, 'tagline')}</span>
          </div>
          <div className="topbar-right">
            <span className={'agent-badge' + (mcp.active ? ' on' : '') + (pulse ? ' pulse' : '')} title={mcp.active ? '' : t(lang, 'agent_inactive')}>
              <span className="dot" />
              {mcp.active ? `${mcp.count} ${t(lang, 'agent_active')}` : 'WebMCP off'}
            </span>
            <button
              className="lang-toggle"
              onClick={() => update((st) => { st.lang = st.lang === 'en' ? 'ko' : 'en' })}
            >
              {t(lang, 'lang_toggle')}
            </button>
          </div>
        </header>

        {!mcp.active && (
          <div className="mcp-hint">{t(lang, 'agent_inactive')}</div>
        )}

        <nav className="tabs">
          {TABS.map(([id, key]) => (
            <button
              key={id}
              className={'tab' + (s.tab === id ? ' active' : '')}
              onClick={() => update((st) => { st.tab = id })}
            >
              {t(lang, key)}
            </button>
          ))}
        </nav>

        <main className="content">
          {!data.loaded ? (
            <div className="loading">Loading regulation data…</div>
          ) : s.tab === 'dashboard' ? (
            <Dashboard />
          ) : s.tab === 'assessment' ? (
            <Assessment />
          ) : s.tab === 'evidence' ? (
            <Evidence />
          ) : (
            <Regulations />
          )}
        </main>

        <footer className="footer">
          <span>safeU — WebMCP Challenge 2026 · MIT License · Data: law.go.kr · KOSHA (KOGL) · No sign-up, everything stays in your browser.</span>
        </footer>

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
