import { useState, useEffect, useRef } from 'react'
import exercises from '../data/german-exercises.json'

// Level assignment based on ID (no JSON changes needed)
function getLevelForId(id) {
  if (id <= 30) return 'A2'
  if (id <= 80) return 'B1'
  return 'B2'
}

function getExercisesForLevel(level) {
  if (level === 'All') return exercises
  return exercises.filter(e => getLevelForId(e.id) === level)
}

// ── localStorage helpers ─────────────────────────────────────────────────
function getStats() {
  try { return JSON.parse(localStorage.getItem('dashboard_germanStats') || '{"completed":[],"correct":0,"total":0}') }
  catch { return { completed: [], correct: 0, total: 0 } }
}
function saveStats(s) { localStorage.setItem('dashboard_germanStats', JSON.stringify(s)) }

function getMistakes() {
  try { return JSON.parse(localStorage.getItem('dashboard_germanMistakes') || '[]') }
  catch { return [] }
}
function saveMistakes(m) { localStorage.setItem('dashboard_germanMistakes', JSON.stringify(m)) }

function getCompletedDates() {
  try { return JSON.parse(localStorage.getItem('dashboard_germanDates') || '[]') }
  catch { return [] }
}
function addCompletedDate() {
  const today = new Date().toISOString().split('T')[0]
  const dates = getCompletedDates()
  if (!dates.includes(today)) {
    localStorage.setItem('dashboard_germanDates', JSON.stringify([...dates, today]))
  }
}

function getStreak() {
  try {
    const raw = localStorage.getItem('dashboard_germanStreak')
    if (!raw) return { count: 0, lastDate: null }
    return JSON.parse(raw)
  } catch { return { count: 0, lastDate: null } }
}
function updateStreak() {
  const today     = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const streak = getStreak()
  if (streak.lastDate === today) return streak.count
  const newCount = streak.lastDate === yesterday ? streak.count + 1 : 1
  localStorage.setItem('dashboard_germanStreak', JSON.stringify({ count: newCount, lastDate: today }))
  return newCount
}

// ── Week calendar helpers ─────────────────────────────────────────────────
function getCurrentWeek() {
  const today = new Date()
  const day = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}
function toISO(d) { return d.toISOString().split('T')[0] }

// ── Umlaut normalisation ───────────────────────────────────────────────────
// Converts ae/oe/ue/ss substitutes to their umlaut equivalents so that
// e.g. "Sueden" and "Süden" are treated as the same answer.
function replaceUmlautSubs(str) {
  return str
    .replace(/Ae/g, 'Ä').replace(/ae/g, 'ä')
    .replace(/Oe/g, 'Ö').replace(/oe/g, 'ö')
    .replace(/Ue/g, 'Ü').replace(/ue/g, 'ü')
    .replace(/ss/g,  'ß')
}
function normalizeAnswer(str) {
  return replaceUmlautSubs(str.trim()).toLowerCase()
}

const UMLAUTS = ['ä', 'ö', 'ü', 'Ä', 'Ö', 'Ü', 'ß']

// ── Exercise picker ────────────────────────────────────────────────────────
function pickExercise(completed, level) {
  const pool = getExercisesForLevel(level)
  const remaining = pool.filter(e => !completed.includes(e.id))
  const src = remaining.length > 0 ? remaining : pool
  return src[Math.floor(Math.random() * src.length)]
}

function pickMistakeExercise(mistakeIds, level) {
  const pool = getExercisesForLevel(level)
  const src = pool.filter(e => mistakeIds.includes(e.id))
  if (src.length === 0) return null
  return src[Math.floor(Math.random() * src.length)]
}

// ── Difficulty segmented control ──────────────────────────────────────────
const LEVELS = ['All', 'A2', 'B1', 'B2']

export default function GermanWidget() {
  const [stats,   setStats]   = useState(getStats)
  const [streak,  setStreak]  = useState(getStreak().count)
  const [difficulty, setDifficulty] = useState(() =>
    localStorage.getItem('dashboard_germanLevel') || 'B1'
  )
  const [reviewMode, setReviewMode] = useState(false)
  const [exercise,   setExercise]   = useState(() =>
    pickExercise(getStats().completed, localStorage.getItem('dashboard_germanLevel') || 'B1')
  )
  const [answers,          setAnswers]          = useState({})
  const [checked,          setChecked]          = useState(false)
  const [showTranslation,  setShowTranslation]  = useState({})
  const [weekDays]       = useState(getCurrentWeek)
  const [completedDates, setCompletedDates] = useState(getCompletedDates)
  const [focusedLine,    setFocusedLine]    = useState(null)
  const inputRefs = useRef({})

  function changeDifficulty(level) {
    setDifficulty(level)
    localStorage.setItem('dashboard_germanLevel', level)
    loadNew(level, false)
  }

  function loadNew(level = difficulty, review = false) {
    let ex
    if (review) {
      const mistakes = getMistakes()
      ex = pickMistakeExercise(mistakes, level)
      if (!ex) { setReviewMode(false); return }
    } else {
      ex = pickExercise(getStats().completed, level)
    }
    setExercise(ex)
    setAnswers({})
    setChecked(false)
    setShowTranslation({})
    setReviewMode(review)
  }

  function insertUmlaut(char) {
    if (focusedLine === null) return
    const input = inputRefs.current[focusedLine]
    if (!input) return
    const start = input.selectionStart ?? input.value.length
    const end   = input.selectionEnd   ?? input.value.length
    const current = answers[focusedLine] || ''
    const newVal = current.slice(0, start) + char + current.slice(end)
    setAnswers(prev => ({ ...prev, [focusedLine]: newVal }))
    // Restore cursor after React re-render
    requestAnimationFrame(() => {
      input.focus()
      input.setSelectionRange(start + char.length, start + char.length)
    })
  }

  function handleCheck() {
    if (checked) return
    const s = getStats()
    let correctCount = 0

    exercise.dialogue.forEach((line, i) => {
      if (normalizeAnswer(answers[i] || '') === normalizeAnswer(line.answer)) correctCount++
    })
    const total = exercise.dialogue.length

    // Update stats
    const newStats = {
      completed: s.completed.includes(exercise.id) ? s.completed : [...s.completed, exercise.id],
      correct:   s.correct + correctCount,
      total:     s.total + total,
    }
    saveStats(newStats)
    setStats(newStats)

    // Track mistakes
    const mistakes = getMistakes()
    if (correctCount < total) {
      if (!mistakes.includes(exercise.id)) saveMistakes([...mistakes, exercise.id])
    } else {
      saveMistakes(mistakes.filter(id => id !== exercise.id))
    }

    // Streak & completion dates
    const newStreak = updateStreak()
    setStreak(newStreak)
    addCompletedDate()
    setCompletedDates(getCompletedDates())

    setChecked(true)
  }

  function toggleTranslation(i) {
    setShowTranslation(prev => ({ ...prev, [i]: !prev[i] }))
  }

  const levelPool      = getExercisesForLevel(difficulty)
  const levelTotal     = levelPool.length
  const levelCompleted = levelPool.filter(e => stats.completed.includes(e.id)).length
  const accuracyPct    = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
  const mistakes       = getMistakes()
  const hasMistakes    = mistakes.length > 0

  const todayStr = toISO(new Date())

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🇩🇪</span>
          <h2 className="font-semibold text-slate-100">German Practice</h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          {streak > 0 && <span className="text-amber-400">🔥 {streak}d</span>}
          <span>{levelCompleted}/{levelTotal}</span>
        </div>
      </div>

      {/* Difficulty + progress row */}
      <div className="flex items-center justify-between gap-2">
        {/* Segmented control */}
        <div className="flex bg-slate-700 rounded-lg p-0.5 gap-0.5">
          {LEVELS.map(lvl => (
            <button key={lvl}
              onClick={() => changeDifficulty(lvl)}
              className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors ${
                difficulty === lvl
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >{lvl}</button>
          ))}
        </div>
        {/* Accuracy */}
        {stats.total > 0 && (
          <span className="text-xs text-slate-400">
            <span className={accuracyPct >= 70 ? 'text-green-400' : 'text-amber-400'}>{accuracyPct}%</span>
            {' '}acc
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-700 rounded-full h-1.5">
        <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${(levelCompleted / levelTotal) * 100}%` }} />
      </div>

      {/* Theme + review badge */}
      <div className="flex items-center gap-2">
        <span className="text-xs bg-slate-700 text-slate-300 rounded-full px-2 py-0.5">
          {exercise.theme}
        </span>
        <span className="text-xs text-slate-500">
          {getLevelForId(exercise.id)}
        </span>
        {reviewMode && (
          <span className="text-xs bg-amber-800/40 text-amber-300 rounded-full px-2 py-0.5">
            ✎ Review
          </span>
        )}
      </div>

      {/* Dialogue */}
      <div className="space-y-3 flex-1">
        {exercise.dialogue.map((line, i) => {
          const ua        = answers[i] || ''
          const isCorrect = checked && normalizeAnswer(ua) === normalizeAnswer(line.answer)
          const isWrong   = checked && normalizeAnswer(ua) !== normalizeAnswer(line.answer)

          return (
            <div key={i} className="space-y-1">
              <div className="flex items-start gap-2">
                <span className="text-xs font-bold text-blue-400 w-4 flex-shrink-0 mt-0.5">
                  {line.speaker}:
                </span>
                <div className="flex-1">
                  <div className="text-sm text-slate-300 leading-relaxed">
                    {line.blank.split('___').map((part, j, arr) => (
                      <span key={j}>
                        {part}
                        {j < arr.length - 1 && (
                          <span className="inline-block">
                            {checked ? (
                              <span className={`font-bold mx-0.5 ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                                {isWrong ? (
                                  <>
                                    <span className="line-through opacity-60">{ua || '?'}</span>
                                    <span className="ml-1">{line.answer}</span>
                                  </>
                                ) : ua}
                              </span>
                            ) : (
                              <input
                                ref={el => { inputRefs.current[i] = el }}
                                type="text"
                                value={ua}
                                onChange={e => setAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && handleCheck()}
                                onFocus={() => setFocusedLine(i)}
                                className="inline-block w-24 border-b border-slate-500 bg-transparent text-slate-200 text-sm px-1 focus:outline-none focus:border-blue-400 mx-0.5"
                                placeholder="___"
                              />
                            )}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                  {showTranslation[i] && (
                    <p className="text-xs text-slate-500 italic mt-0.5">{line.english}</p>
                  )}
                </div>
                <button onClick={() => toggleTranslation(i)}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0">
                  {showTranslation[i] ? '🔼' : '🔽'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Umlaut insertion buttons */}
      {!checked && (
        <div className="flex gap-1 flex-wrap">
          {UMLAUTS.map(char => (
            <button
              key={char}
              onMouseDown={e => { e.preventDefault(); insertUmlaut(char) }}
              className={`px-2 py-0.5 rounded text-sm font-mono border transition-colors select-none ${
                focusedLine !== null
                  ? 'border-slate-600 bg-slate-700 text-slate-200 hover:bg-slate-600 hover:border-slate-500'
                  : 'border-slate-700 bg-slate-800 text-slate-600 cursor-default'
              }`}
              tabIndex={-1}
            >{char}</button>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 pt-1 border-t border-slate-700">
        {!checked ? (
          <button onClick={handleCheck}
            className="flex-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm py-1.5 font-medium transition-colors">
            Check
          </button>
        ) : (
          <>
            <button onClick={() => loadNew(difficulty, false)}
              className="flex-1 rounded-lg bg-green-700 hover:bg-green-600 text-white text-sm py-1.5 font-medium transition-colors">
              Next →
            </button>
            <button
              onClick={() => loadNew(difficulty, true)}
              disabled={!hasMistakes}
              title={hasMistakes ? `Review ${mistakes.length} mistake(s)` : 'No mistakes to review'}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                hasMistakes
                  ? 'bg-amber-700 hover:bg-amber-600 text-white'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }`}
            >✎</button>
          </>
        )}
      </div>

      {/* Streak calendar */}
      <div className="pt-1 border-t border-slate-700/50">
        <p className="text-xs text-slate-500 mb-1.5">This week</p>
        <div className="flex gap-1.5 justify-between">
          {weekDays.map(day => {
            const dateStr   = toISO(day)
            const done      = completedDates.includes(dateStr)
            const isToday   = dateStr === todayStr
            const dayLetter = day.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 1)
            return (
              <div key={dateStr} className="flex flex-col items-center gap-0.5">
                <span className="text-xs text-slate-600">{dayLetter}</span>
                <div className={`w-5 h-5 rounded-sm transition-colors ${
                  done ? 'bg-green-600' : 'bg-slate-700'
                } ${isToday ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-slate-800' : ''}`} />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
