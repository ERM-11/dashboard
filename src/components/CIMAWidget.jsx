import { useState, useMemo } from 'react'
import questions from '../data/cima-questions.json'

// ── Constants ─────────────────────────────────────────────────────────────────
const MODULES = ['BA1', 'BA2', 'BA3', 'BA4']

const MODULE_COLORS = {
  BA1: { accent: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.35)',  text: '#93c5fd' },
  BA2: { accent: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.35)',  text: '#6ee7b7' },
  BA3: { accent: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.35)',  text: '#c4b5fd' },
  BA4: { accent: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)',  text: '#fcd34d' },
}

const DIFFICULTY_COLORS = { easy: '#22c55e', medium: '#f59e0b', hard: '#ef4444' }

const SPACED_INTERVALS = [1, 3, 7, 14, 30] // days

// ── localStorage helpers ──────────────────────────────────────────────────────
const today = () => new Date().toISOString().split('T')[0]

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback }
  catch { return fallback }
}
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)) }

function loadAttempts()       { return load('dashboard_cima_attempts', {}) }
function loadReviewQueue()    { return load('dashboard_cima_reviewQueue', []) }
function loadStreak()         { return load('dashboard_cima_streak', { current: 0, best: 0, lastStudyDate: null }) }
function loadHistory()        { return load('dashboard_cima_history', []) }
function loadDailyCompleted() { return load('dashboard_cima_dailyCompleted', {}) }

// ── Streak helpers ────────────────────────────────────────────────────────────
function recordStudyDay(streak) {
  const t = today()
  if (streak.lastStudyDate === t) return streak
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const next = streak.lastStudyDate === yesterday ? streak.current + 1 : 1
  const best = Math.max(streak.best, next)
  return { current: next, best, lastStudyDate: t }
}

// ── Topic accuracy helper ─────────────────────────────────────────────────────
function topicAccuracy(module, attempts) {
  const qs = questions[module] || []
  const byTopic = {}
  qs.forEach(q => {
    const a = attempts[q.id]
    if (!a) return
    if (!byTopic[q.topic]) byTopic[q.topic] = { correct: 0, total: 0 }
    byTopic[q.topic].correct += a.correct
    byTopic[q.topic].total   += a.attempts
  })
  return byTopic
}

function weakestTopic(module, attempts) {
  const acc = topicAccuracy(module, attempts)
  const attempted = Object.entries(acc).filter(([, v]) => v.total > 0)
  if (!attempted.length) return null
  return attempted.reduce((w, [t, v]) =>
    (v.correct / v.total) < (w[1].correct / w[1].total) ? [t, v] : w
  )[0]
}

// ── Daily question (deterministic by day) ────────────────────────────────────
function getDailyQuestion(module) {
  const qs = questions[module] || []
  if (!qs.length) return null
  const start   = new Date(new Date().getFullYear(), 0, 0)
  const dayOfYr = Math.floor((Date.now() - start) / 86400000)
  return qs[dayOfYr % qs.length]
}

// ── Question picker ───────────────────────────────────────────────────────────
function pickRandom(module, attempts, exclude = []) {
  const qs   = (questions[module] || []).filter(q => !exclude.includes(q.id))
  const pool = qs.length ? qs : questions[module] || []
  return pool[Math.floor(Math.random() * pool.length)] || null
}

function pickReview(reviewQueue) {
  const t = today()
  const due = reviewQueue.filter(item => {
    const last = new Date(item.lastAttempted)
    const due  = new Date(last.getTime() + item.interval * 86400000)
    return new Date(t) >= due
  })
  if (!due.length) return null
  const id = due[Math.floor(Math.random() * due.length)].questionId
  for (const mod of MODULES) {
    const q = (questions[mod] || []).find(q => q.id === id)
    if (q) return q
  }
  return null
}

function pickWeakest(module, attempts) {
  const topic = weakestTopic(module, attempts)
  if (!topic) return pickRandom(module, attempts, [])
  const pool = (questions[module] || []).filter(q => q.topic === topic)
  return pool[Math.floor(Math.random() * pool.length)] || pickRandom(module, attempts, [])
}

// ── Stats helpers ─────────────────────────────────────────────────────────────
function moduleStats(module, attempts) {
  const qs    = questions[module] || []
  const total = qs.length
  const att   = qs.filter(q => attempts[q.id]?.attempts > 0)
  const done  = att.length
  const correct = att.reduce((s, q) => s + (attempts[q.id]?.correct ?? 0), 0)
  const tried   = att.reduce((s, q) => s + (attempts[q.id]?.attempts ?? 0), 0)
  const accuracy = tried > 0 ? Math.round((correct / tried) * 100) : 0
  return { total, done, accuracy }
}

function overallStats(attempts) {
  return MODULES.reduce((acc, m) => {
    const s = moduleStats(m, attempts)
    acc.done  += s.done
    acc.total += s.total
    return acc
  }, { done: 0, total: 0 })
}

// ── Update review queue after answer ─────────────────────────────────────────
function updateReviewQueue(queue, questionId, correct) {
  const idx = queue.findIndex(i => i.questionId === questionId)
  if (correct) {
    if (idx < 0) return queue // not in queue, nothing to do
    const item = queue[idx]
    const nextInterval = Math.min(item.interval * 2, 30)
    const updated = [...queue]
    updated[idx] = { ...item, interval: nextInterval, lastAttempted: today() }
    return updated
  } else {
    if (idx >= 0) {
      // Wrong again — reset interval
      const updated = [...queue]
      updated[idx] = { ...queue[idx], interval: 1, timesWrong: queue[idx].timesWrong + 1, lastAttempted: today() }
      return updated
    }
    return [...queue, { questionId, lastAttempted: today(), interval: 1, timesWrong: 1 }]
  }
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CIMAWidget() {
  const [activeModule,    setActiveModule]    = useState(() => load('dashboard_cima_activeModule', 'BA1'))
  const [attempts,        setAttempts]        = useState(loadAttempts)
  const [reviewQueue,     setReviewQueue]     = useState(loadReviewQueue)
  const [streak,          setStreak]          = useState(loadStreak)
  const [history,         setHistory]         = useState(loadHistory)
  const [dailyCompleted,  setDailyCompleted]  = useState(loadDailyCompleted)

  const [currentQ,        setCurrentQ]        = useState(() => pickRandom(load('dashboard_cima_activeModule', 'BA1'), loadAttempts(), []))
  const [selectedAnswer,  setSelectedAnswer]  = useState(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [questionMode,    setQuestionMode]    = useState('random') // 'random'|'review'|'weakest'|'daily'
  const [showHistory,     setShowHistory]     = useState(false)
  const [resetConfirm,    setResetConfirm]    = useState(false)

  const mc = MODULE_COLORS[activeModule]
  const mStats = moduleStats(activeModule, attempts)
  const oStats = overallStats(attempts)
  const dailyQ = getDailyQuestion(activeModule)
  const isDailyQ = currentQ?.id === dailyQ?.id
  const reviewDue = useMemo(() => {
    const t = today()
    return reviewQueue.filter(item => {
      const due = new Date(new Date(item.lastAttempted).getTime() + item.interval * 86400000)
      return new Date(t) >= due
    }).length
  }, [reviewQueue])

  function switchModule(mod) {
    setActiveModule(mod)
    save('dashboard_cima_activeModule', mod)
    loadQuestion('random', mod)
    setResetConfirm(false)
  }

  function loadQuestion(mode = questionMode, mod = activeModule) {
    setSelectedAnswer(null)
    setShowExplanation(false)
    setQuestionMode(mode)
    const att = loadAttempts()
    let q = null
    if (mode === 'daily')   q = getDailyQuestion(mod)
    else if (mode === 'review')  q = pickReview(loadReviewQueue())
    else if (mode === 'weakest') q = pickWeakest(mod, att)
    else q = pickRandom(mod, att, [])
    setCurrentQ(q)
  }

  function handleAnswer(letter) {
    if (selectedAnswer) return
    setSelectedAnswer(letter)
    setShowExplanation(true)

    const correct = letter === currentQ.correct
    const prev    = attempts[currentQ.id] || { attempts: 0, correct: 0, bookmarked: false }
    const nextAtt = {
      ...prev,
      attempts:      prev.attempts + 1,
      correct:       prev.correct + (correct ? 1 : 0),
      lastAttempted: today(),
    }
    const newAttempts = { ...attempts, [currentQ.id]: nextAtt }
    setAttempts(newAttempts)
    save('dashboard_cima_attempts', newAttempts)

    // Spaced repetition
    const newQueue = updateReviewQueue(reviewQueue, currentQ.id, correct)
    setReviewQueue(newQueue)
    save('dashboard_cima_reviewQueue', newQueue)

    // Streak
    const newStreak = recordStudyDay(streak)
    setStreak(newStreak)
    save('dashboard_cima_streak', newStreak)

    // History (keep last 50)
    const entry = { questionId: currentQ.id, module: activeModule, topic: currentQ.topic, correct, date: today() }
    const newHistory = [entry, ...history].slice(0, 50)
    setHistory(newHistory)
    save('dashboard_cima_history', newHistory)

    // Daily completed
    if (isDailyQ) {
      const dc = { ...dailyCompleted }
      if (!dc[today()]) dc[today()] = {}
      dc[today()][activeModule] = true
      setDailyCompleted(dc)
      save('dashboard_cima_dailyCompleted', dc)
    }
  }

  function bookmark() {
    const prev = attempts[currentQ.id] || { attempts: 0, correct: 0, bookmarked: false }
    const newAttempts = { ...attempts, [currentQ.id]: { ...prev, bookmarked: true } }
    setAttempts(newAttempts)
    save('dashboard_cima_attempts', newAttempts)
    // Also add to review queue if not already there
    if (!reviewQueue.find(i => i.questionId === currentQ.id)) {
      const newQueue = [...reviewQueue, { questionId: currentQ.id, lastAttempted: today(), interval: 1, timesWrong: 0 }]
      setReviewQueue(newQueue)
      save('dashboard_cima_reviewQueue', newQueue)
    }
  }

  function resetModule() {
    const newAttempts = { ...attempts }
    ;(questions[activeModule] || []).forEach(q => { delete newAttempts[q.id] })
    const newQueue = reviewQueue.filter(item => !item.questionId.startsWith(activeModule + '-'))
    setAttempts(newAttempts); save('dashboard_cima_attempts', newAttempts)
    setReviewQueue(newQueue); save('dashboard_cima_reviewQueue', newQueue)
    setResetConfirm(false)
    loadQuestion('random', activeModule)
  }

  function reAttempt(qId) {
    for (const mod of MODULES) {
      const q = (questions[mod] || []).find(q => q.id === qId)
      if (q) { setCurrentQ(q); setSelectedAnswer(null); setShowExplanation(false); break }
    }
  }

  const isCorrect  = selectedAnswer && selectedAnswer === currentQ?.correct
  const isAnswered = !!selectedAnswer

  // ── Render ────────────────────────────────────────────────────────────────
  if (!currentQ) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg p-4 flex items-center justify-center min-h-[200px]">
        <p className="text-slate-400 text-sm">No questions available</p>
      </div>
    )
  }

  const diffColor = DIFFICULTY_COLORS[currentQ.difficulty] || '#94a3b8'

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg p-4 flex flex-col gap-4">

      {/* ── Section 1: Module tabs + stats ── */}
      <div className="flex flex-col gap-3">

        {/* Module tabs */}
        <div className="flex items-center justify-between">
          <div className="flex bg-slate-700/60 rounded-lg p-0.5 gap-0.5">
            {MODULES.map(mod => {
              const active = activeModule === mod
              const col = MODULE_COLORS[mod]
              return (
                <button key={mod} onClick={() => switchModule(mod)}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold transition-all"
                  style={active
                    ? { background: col.bg, color: col.text, border: `1px solid ${col.border}` }
                    : { color: '#64748b', border: '1px solid transparent' }
                  }>
                  {mod}
                </button>
              )
            })}
          </div>

          {/* Streak badge */}
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {streak.current > 0 && (
              <span style={{ color: streak.current >= 7 ? '#f59e0b' : '#94a3b8' }}>
                {streak.current >= 7 ? '🔥' : '📅'} {streak.current}d
              </span>
            )}
            <span>Best: {streak.best}d</span>
          </div>
        </div>

        {/* Module stats row */}
        <div className="flex items-center gap-4 text-xs">
          <span className="text-slate-400">
            Questions: <span className="font-mono" style={{ color: mc.text }}>{mStats.done}/{mStats.total}</span>
          </span>
          <span className="text-slate-400">
            Accuracy: <span className="font-mono" style={{ color: mStats.accuracy >= 70 ? '#22c55e' : mStats.accuracy >= 30 ? '#f59e0b' : '#ef4444' }}>{mStats.accuracy}%</span>
          </span>
        </div>

        {/* Module progress bar */}
        <div className="rounded-full overflow-hidden" style={{ height: '5px', background: 'rgba(255,255,255,0.06)' }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${mStats.total > 0 ? (mStats.done / mStats.total) * 100 : 0}%`,
              background: mStats.accuracy >= 70 ? '#22c55e' : mStats.accuracy >= 30 ? '#f59e0b' : mc.accent,
            }} />
        </div>

        {/* Overall summary */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500">
            Overall: <span className="text-slate-300 font-mono">{oStats.done}/{oStats.total}</span>
          </span>
          <div className="flex gap-1 flex-1">
            {MODULES.map(mod => {
              const s = moduleStats(mod, attempts)
              const col = MODULE_COLORS[mod]
              return (
                <div key={mod} className="flex-1 rounded-full overflow-hidden" style={{ height: '4px', background: 'rgba(255,255,255,0.05)' }}>
                  <div className="h-full rounded-full" style={{
                    width: `${s.total > 0 ? (s.done / s.total) * 100 : 0}%`,
                    background: col.accent,
                  }} />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Section 2: Question card ── */}
      <div className="rounded-xl p-4 flex flex-col gap-3 border"
        style={{ background: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,255,255,0.07)' }}>

        {/* Question meta */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2 py-0.5 rounded-full text-xs font-bold"
            style={{ background: mc.bg, color: mc.text, border: `1px solid ${mc.border}` }}>
            {activeModule}
          </span>
          <span className="text-xs text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded-full">
            {currentQ.topic}
          </span>
          <span className="text-xs font-mono capitalize" style={{ color: diffColor }}>
            ● {currentQ.difficulty}
          </span>
          {isDailyQ && (
            <span className="text-xs text-amber-400 ml-auto">⭐ Daily</span>
          )}
        </div>

        {/* Question text */}
        <p className="text-sm font-semibold text-slate-100 leading-relaxed">{currentQ.question}</p>

        {/* Answer options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Object.entries(currentQ.options).map(([letter, text]) => {
            const isSelected = selectedAnswer === letter
            const isCorrectOpt = letter === currentQ.correct
            let bg = 'rgba(255,255,255,0.03)'
            let border = 'rgba(255,255,255,0.08)'
            let textColor = '#94a3b8'

            if (isAnswered) {
              if (isCorrectOpt) { bg = 'rgba(34,197,94,0.12)'; border = '#22c55e'; textColor = '#86efac' }
              else if (isSelected && !isCorrectOpt) { bg = 'rgba(239,68,68,0.12)'; border = '#ef4444'; textColor = '#fca5a5' }
            }

            return (
              <button
                key={letter}
                onClick={() => handleAnswer(letter)}
                disabled={isAnswered}
                className="text-left p-3 rounded-lg text-sm transition-all duration-200 disabled:cursor-default"
                style={{
                  background: bg,
                  border: `1px solid ${border}`,
                  color: textColor,
                  cursor: isAnswered ? 'default' : 'pointer',
                  ...(isAnswered ? {} : { ':hover': { background: 'rgba(255,255,255,0.07)' } }),
                }}
                onMouseEnter={e => { if (!isAnswered) e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
                onMouseLeave={e => { if (!isAnswered) e.currentTarget.style.background = bg }}
              >
                <span className="font-bold mr-2 font-mono">{letter}.</span>{text}
                {isAnswered && isCorrectOpt && <span className="ml-2">✓</span>}
                {isAnswered && isSelected && !isCorrectOpt && <span className="ml-2">✗</span>}
              </button>
            )
          })}
        </div>

        {/* Explanation */}
        {showExplanation && (
          <div className="animate-reveal rounded-lg p-3 text-xs text-slate-300 leading-relaxed border"
            style={{ background: isCorrect ? 'rgba(34,197,94,0.07)' : 'rgba(239,68,68,0.07)', borderColor: isCorrect ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)' }}>
            <span className="font-semibold" style={{ color: isCorrect ? '#22c55e' : '#ef4444' }}>
              {isCorrect ? '✓ Correct — ' : '✗ Incorrect — '}
            </span>
            {currentQ.explanation}
          </div>
        )}

        {/* Post-answer actions */}
        {isAnswered && (
          <div className="flex gap-2">
            <button onClick={() => loadQuestion(questionMode)}
              className="flex-1 py-1.5 rounded-lg text-sm font-medium text-white transition-colors"
              style={{ background: mc.accent }}>
              Next Question →
            </button>
            {!isCorrect && (
              <button onClick={bookmark}
                title="Save for review"
                className="px-3 py-1.5 rounded-lg text-sm border border-amber-600/40 text-amber-400 hover:bg-amber-600/10 transition-colors">
                🔖
              </button>
            )}
          </div>
        )}

        {/* Skip (only before answering) */}
        {!isAnswered && (
          <button onClick={() => loadQuestion(questionMode)}
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors self-end">
            Skip →
          </button>
        )}
      </div>

      {/* ── Section 3: Controls ── */}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Random',       mode: 'random',  always: true },
            { label: `Review${reviewDue > 0 ? ` (${reviewDue})` : ''}`,
              mode: 'review',  always: false, disabled: reviewDue === 0, title: reviewDue === 0 ? 'No questions due for review' : undefined },
            { label: 'Weakest',      mode: 'weakest', always: true },
          ].map(({ label, mode, disabled, title }) => (
            <button key={mode}
              onClick={() => !disabled && loadQuestion(mode)}
              disabled={!!disabled}
              title={title}
              className="py-1.5 rounded-lg text-xs font-medium border transition-colors"
              style={questionMode === mode && !disabled
                ? { background: mc.bg, color: mc.text, borderColor: mc.border }
                : disabled
                  ? { background: 'transparent', color: '#374151', borderColor: '#1f2937', cursor: 'not-allowed' }
                  : { background: 'transparent', color: '#94a3b8', borderColor: '#334155' }
              }>
              {label}
            </button>
          ))}
        </div>

        {/* Daily question button */}
        <button onClick={() => loadQuestion('daily')}
          className="py-1.5 rounded-lg text-xs font-medium border transition-colors w-full"
          style={questionMode === 'daily'
            ? { background: 'rgba(245,158,11,0.12)', color: '#fcd34d', borderColor: 'rgba(245,158,11,0.3)' }
            : { background: 'transparent', color: '#78716c', borderColor: '#292524' }
          }>
          ⭐ Daily Question
        </button>

        {/* Study history (collapsible) */}
        <div>
          <button onClick={() => setShowHistory(h => !h)}
            className="flex items-center justify-between w-full text-xs text-slate-500 hover:text-slate-300 transition-colors py-1">
            <span>Study History ({history.length})</span>
            <span>{showHistory ? '▲' : '▼'}</span>
          </button>
          <div style={{
            maxHeight: showHistory ? '220px' : '0',
            overflow: 'hidden',
            transition: 'max-height 0.3s ease',
          }}>
            {history.slice(0, 10).length > 0 ? (
              <div className="space-y-1 pt-1 overflow-y-auto" style={{ maxHeight: '208px' }}>
                {history.slice(0, 10).map((entry, i) => (
                  <button key={i}
                    onClick={() => reAttempt(entry.questionId)}
                    className="flex items-center gap-2 w-full text-left p-1.5 rounded-lg hover:bg-slate-700/40 transition-colors">
                    <span style={{ color: entry.correct ? '#22c55e' : '#ef4444', fontSize: '10px' }}>
                      {entry.correct ? '✓' : '✗'}
                    </span>
                    <span className="text-xs font-mono" style={{ color: MODULE_COLORS[entry.module].text }}>{entry.module}</span>
                    <span className="text-xs text-slate-400 truncate flex-1">{entry.topic}</span>
                    <span className="text-xs text-slate-600 flex-shrink-0">{entry.date}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-600 py-2 text-center">No history yet</p>
            )}
          </div>
        </div>

        {/* Reset module */}
        <div className="pt-1 border-t border-slate-700/50">
          {!resetConfirm ? (
            <button onClick={() => setResetConfirm(true)}
              className="text-xs text-slate-600 hover:text-red-400 transition-colors">
              Reset {activeModule} progress
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-400">Clear all {activeModule} progress?</span>
              <button onClick={resetModule}
                className="text-xs px-2 py-0.5 rounded bg-red-700 hover:bg-red-600 text-white transition-colors">Yes</button>
              <button onClick={() => setResetConfirm(false)}
                className="text-xs px-2 py-0.5 rounded bg-slate-600 hover:bg-slate-500 text-white transition-colors">No</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
