// Print-only document pack (Korean-primary — these are documents for a Korean
// labor-office inspection). Rendered always, shown only via @media print.
import React from 'react'
import { useStore, data, riskOf, bandOf, tbmRows, sapaApplicableIdx } from '../store.js'
import { pick } from '../i18n.js'

const SAPA_STATUS_KO = { none: '미이행', partial: '이행 중', done: '이행' }

const BAND_KO = { low: '낮음', medium: '보통', high: '높음' }
const STATUS_KO = { open: '미조치', progress: '조치 중', done: '완료' }

function industryName(s) {
  const ind = data.obligations?.industries?.find((i) => i.id === s.profile?.industry)
  return ind ? pick(ind, 'ko') : s.profile?.industry || ''
}

export default function PrintPack() {
  const s = useStore()
  const rows = s.assessment.rows
  const highRows = rows.filter((r) => riskOf(r.likelihood, r.severity) >= 6)
  const workers = s.participation.workers

  return (
    <div className="print-only">
      {/* ── 1. 위험성평가표 ─────────────────────────────── */}
      <section className="print-page">
        <h1>위험성평가표 <span className="en-sub">Risk Assessment</span></h1>
        <table className="p-meta">
          <tbody>
            <tr>
              <th>사업장명</th><td>{s.profile?.companyName || ''}</td>
              <th>업종</th><td>{industryName(s)}</td>
              <th>상시근로자 수</th><td>{s.profile?.workers ?? ''}명</td>
            </tr>
            <tr>
              <th>평가명</th><td>{s.assessment.title}</td>
              <th>평가일</th><td>{s.assessment.date}</td>
              <th>평가방법</th><td>빈도·강도법 (고시 제2024-76호)</td>
            </tr>
          </tbody>
        </table>
        <table className="p-rows">
          <thead>
            <tr>
              <th>연번</th><th>공정/작업</th><th>유해·위험요인</th><th>원인/상황</th>
              <th>현재 조치</th><th>빈도</th><th>강도</th><th>위험성</th><th>감소대책</th><th>상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const risk = riskOf(r.likelihood, r.severity)
              return (
                <tr key={r.id}>
                  <td>{i + 1}</td>
                  <td>{r.process}</td>
                  <td>{r.hazard}</td>
                  <td>{r.cause}</td>
                  <td>{r.current_controls}</td>
                  <td>{r.likelihood}</td>
                  <td>{r.severity}</td>
                  <td>{risk} ({BAND_KO[bandOf(risk)]})</td>
                  <td>{r.measures}</td>
                  <td>{STATUS_KO[r.status] || r.status}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="p-note">위험성 = 빈도(1~3) × 강도(1~3) — 1~2 낮음 / 3~4 보통 / 6~9 높음 · 본 기록은 산업안전보건법 시행규칙 제37조의4에 따라 3년간 보존합니다.</p>
        <table className="p-sign">
          <tbody>
            <tr>
              <th>작성자</th><td>{s.assessment.preparedBy} (서명: __________ )</td>
              <th>근로자 대표 확인</th><td>__________ (서명: __________ )</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ── 2. 근로자 참여 회의록/공람 기록 ─────────────── */}
      <section className="print-page">
        <h1>위험성평가 근로자 참여 기록 <span className="en-sub">Worker Participation Record</span></h1>
        <p>산업안전보건법 제36조 및 사업장 위험성평가에 관한 지침(고용노동부고시 제2024-76호)에 따라 아래와 같이 근로자가 위험성평가에 참여하였음을 기록합니다.</p>
        <table className="p-meta">
          <tbody>
            <tr>
              <th>참여 방식</th><td>{s.participation.mode === 'meeting' ? '회의' : '공람'}</td>
              <th>일자</th><td>{s.participation.date}</td>
              <th>대상 평가</th><td>{s.assessment.title} ({s.assessment.date})</td>
            </tr>
          </tbody>
        </table>
        <h2>논의된 주요 유해·위험요인 {highRows.length === 0 && '(고위험 없음 — 전체 항목 공유)'}</h2>
        <ul>
          {(highRows.length ? highRows : rows.slice(0, 8)).map((r) => (
            <li key={r.id}>
              [{r.process}] {r.hazard} → 감소대책: {r.measures || '(협의)'}
            </li>
          ))}
        </ul>
        <h2>참여 근로자</h2>
        <table className="p-sign-grid">
          <thead>
            <tr><th>성명</th><th>서명</th><th>성명</th><th>서명</th></tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.max(2, Math.ceil(workers.length / 2)) }).map((_, i) => (
              <tr key={i}>
                <td>{workers[i * 2] || ''}</td><td></td>
                <td>{workers[i * 2 + 1] || ''}</td><td></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ── 3. 결과 공람 확인서 ─────────────────────────── */}
      <section className="print-page">
        <h1>위험성평가 결과 공람 확인서 <span className="en-sub">Result-Sharing Confirmation</span></h1>
        <p>
          아래 서명자는 「{s.assessment.title || '위험성평가'}」({s.assessment.date}) 의 결과(유해·위험요인 및 감소대책)를
          열람·공유받았음을 확인합니다. (산업안전보건법 제36조 — 결과 미공유 시 과태료 최대 500만원)
        </p>
        <table className="p-sign-grid">
          <thead>
            <tr><th>성명</th><th>확인일</th><th>서명</th></tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.max(6, workers.length) }).map((_, i) => (
              <tr key={i}>
                <td>{workers[i] || ''}</td><td></td><td></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ── 4. 게시용 결과 요약 ─────────────────────────── */}
      <section className="print-page poster">
        <h1>우리 사업장 위험성평가 결과 <span className="en-sub">Post this where workers can see it</span></h1>
        <p className="poster-meta">{s.profile?.companyName} · {s.assessment.date} · 작성 {s.assessment.preparedBy}</p>
        <h2>주요 위험과 우리의 대책</h2>
        <table className="p-rows poster-rows">
          <thead>
            <tr><th>작업</th><th>위험</th><th>우리가 하는 조치</th></tr>
          </thead>
          <tbody>
            {(highRows.length ? highRows : rows).slice(0, 10).map((r) => (
              <tr key={r.id}>
                <td>{r.process}</td>
                <td>{r.hazard}</td>
                <td>{r.measures}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="p-note">위험요인을 발견하면 관리자에게 알려주세요. 근로자는 위험성평가에 참여할 권리가 있습니다 (산업안전보건법 제36조).</p>
      </section>

      {/* ── 5. TBM 일지 ─────────────────────────────────── */}
      {s.tbm.date && s.tbm.leader && (
        <section className="print-page">
          <h1>TBM 일지 (작업 전 안전점검회의) <span className="en-sub">Toolbox Meeting Log</span></h1>
          <table className="p-meta">
            <tbody>
              <tr>
                <th>사업장명</th><td>{s.profile?.companyName || ''}</td>
                <th>실시 일자</th><td>{s.tbm.date}</td>
                <th>주재자(관리감독자)</th><td>{s.tbm.leader}</td>
              </tr>
            </tbody>
          </table>
          <h2>오늘의 브리핑 — 위험요인과 지킬 사항</h2>
          <table className="p-rows">
            <thead>
              <tr><th>공정/작업</th><th>유해·위험요인</th><th>오늘 지킬 사항 (감소대책)</th><th>확인</th></tr>
            </thead>
            <tbody>
              {tbmRows(s).map((r) => (
                <tr key={r.id}>
                  <td>{r.process}</td>
                  <td>{r.hazard}</td>
                  <td>{r.measures}</td>
                  <td></td>
                </tr>
              ))}
            </tbody>
          </table>
          <h2>참석자 (서명)</h2>
          <table className="p-sign-grid">
            <thead>
              <tr><th>성명</th><th>서명</th><th>성명</th><th>서명</th></tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.max(3, Math.ceil(s.participation.workers.length / 2)) }).map((_, i) => (
                <tr key={i}>
                  <td>{s.participation.workers[i * 2] || ''}</td><td></td>
                  <td>{s.participation.workers[i * 2 + 1] || ''}</td><td></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="p-note">
            기록된 TBM은 안전보건교육규정(고용노동부고시 제2023-63호)에 따라 관리감독자 주재 등 요건 충족 시 정기 안전보건교육 시간으로 인정될 수 있으며,
            사업장 위험성평가에 관한 지침의 상시평가 일(日) 단위 활동에 해당합니다. (TBM 15분 × 참석 {s.participation.workers.length || '___'}명)
          </p>
        </section>
      )}

      {/* ── 6. 중처법 반기 점검표 ───────────────────────── */}
      {sapaApplicableIdx(s).some((i) => s.sapaCheck.items[i]?.status && s.sapaCheck.items[i].status !== 'none') && (
        <section className="print-page">
          <h1>안전보건관리체계 반기 점검표 <span className="en-sub">SAPA Decree Art. 4 Semiannual Check</span></h1>
          <table className="p-meta">
            <tbody>
              <tr>
                <th>사업장명</th><td>{s.profile?.companyName || ''}</td>
                <th>점검 기간</th><td>{s.sapaCheck.period || ''}</td>
                <th>점검일</th><td>{s.sapaCheck.checkedAt ? new Date(s.sapaCheck.checkedAt).toISOString().slice(0, 10) : ''}</td>
              </tr>
            </tbody>
          </table>
          <p>중대재해처벌법 제4조 및 같은 법 시행령 제4조에 따른 안전보건관리체계 구축·이행 사항을 아래와 같이 점검합니다.</p>
          <table className="p-rows">
            <thead>
              <tr><th>호</th><th>이행 사항</th><th>상태</th><th>증빙</th></tr>
            </thead>
            <tbody>
              {sapaApplicableIdx(s).map((i) => {
                const items = data.regulations?.find((r) => r.id === 'sapa-decree-4')?.items || []
                const it = s.sapaCheck.items[i] || { status: 'none', note: '' }
                return (
                  <tr key={i}>
                    <td>{i + 1}호</td>
                    <td>{pick(items[i], 'ko')}</td>
                    <td>{SAPA_STATUS_KO[it.status]}</td>
                    <td>{it.note}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <table className="p-sign">
            <tbody>
              <tr>
                <th>점검자</th><td>{s.assessment.preparedBy} (서명: __________ )</td>
                <th>경영책임자 확인</th><td>__________ (서명: __________ )</td>
              </tr>
            </tbody>
          </table>
          <p className="p-note">※ 2호(전담조직)는 상시근로자 500명 이상 사업장 등에 한하여 적용됩니다. 유해·위험요인 확인·개선(3호)은 산업안전보건법 제36조 위험성평가 실시 시 반기 점검을 한 것으로 봅니다 (시행령 제4조제3호).</p>
        </section>
      )}
    </div>
  )
}
