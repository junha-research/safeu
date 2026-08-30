// XLSX export (SheetJS) + JSON backup/restore + print fallback. Import of user
// documents is deliberately NOT here — the agent reads files and calls
// add_risk_assessment_rows.
import * as XLSX from 'xlsx'
import { riskOf, bandOf } from './store.js'
import printCss from './print.css?raw'

// Agent-browser webviews (ChatGPT in-app / Atlas) silently ignore
// window.print(). Detect via beforeprint — Chromium fires it synchronously
// before the dialog opens — and fall back to downloading the pack as a
// standalone HTML file that auto-prints when opened in a normal browser.
export function printInspectionPack(onFallback) {
  let dialogOpened = false
  const mark = () => { dialogOpened = true }
  window.addEventListener('beforeprint', mark)
  try {
    window.print()
  } catch {
    /* fall through to fallback */
  }
  window.removeEventListener('beforeprint', mark)
  if (dialogOpened) return true
  downloadPrintPackHtml()
  onFallback?.()
  return false
}

export function downloadPrintPackHtml() {
  const pack = document.querySelector('.print-only')
  if (!pack) return
  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>safeU — 위험성평가 점검 대비 서류 (Inspection Pack)</title>
<style>
body { max-width: 800px; margin: 20px auto; padding: 0 16px;
  font-family: -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; }
${printCss}
.print-only { display: block; }
.print-page { margin-bottom: 40px; }
</style>
</head>
<body>
<div class="print-only">${pack.innerHTML}</div>
<script>setTimeout(() => window.print(), 300)</script>
</body>
</html>`
  const blob = new Blob([html], { type: 'text/html' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'safeU-inspection-pack.html'
  a.click()
  URL.revokeObjectURL(a.href)
}

const BAND_KO = { low: '낮음', medium: '보통', high: '높음' }

export function exportXlsx(state) {
  const s = state
  const meta = [
    ['위험성평가표 (Risk Assessment)'],
    ['사업장명', s.profile?.companyName || '', '업종', s.profile?.industry || '', '상시근로자수', s.profile?.workers ?? ''],
    ['평가명', s.assessment.title || '', '평가일', s.assessment.date || '', '작성자', s.assessment.preparedBy || ''],
    ['평가방법', '빈도·강도법 (고용노동부고시 제2024-76호)'],
    ['근로자 참여', s.participation.workers.join(', '), '참여일', s.participation.date || '', '결과 공유', s.participation.shared ? '완료' : '미완'],
    [],
    ['연번', '공정/작업', '유해·위험요인', '원인/상황', '현재 조치', '빈도(1-3)', '강도(1-3)', '위험성', '판정', '감소대책', '상태', '확정'],
  ]
  const rows = s.assessment.rows.map((r, i) => {
    const risk = riskOf(r.likelihood, r.severity)
    return [
      i + 1,
      r.process,
      r.hazard,
      r.cause || '',
      r.current_controls || '',
      r.likelihood,
      r.severity,
      risk,
      BAND_KO[bandOf(risk)],
      r.measures || '',
      r.status === 'done' ? '완료' : r.status === 'progress' ? '조치 중' : '미조치',
      r.human_confirmed ? '확정' : '미확정',
    ]
  })
  const ws = XLSX.utils.aoa_to_sheet([...meta, ...rows])
  ws['!cols'] = [4, 14, 28, 22, 22, 8, 8, 8, 8, 32, 8, 8].map((w) => ({ wch: w }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '위험성평가')
  XLSX.writeFile(wb, `safeU-risk-assessment-${s.assessment.date || 'draft'}.xlsx`)
}

export function exportBackup(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `safeU-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

export function importBackup(file, onRestore) {
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result)
      if (!parsed || typeof parsed !== 'object' || !parsed.assessment) throw new Error('not a safeU backup')
      onRestore(parsed)
    } catch (e) {
      alert('Could not read backup file: ' + e.message)
    }
  }
  reader.readAsText(file)
}
