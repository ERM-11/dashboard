import { useState, useRef } from 'react'
import vocabulary from '../data/vocabulary.json'

function getDayOfYear() {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  return Math.floor((now - start) / (1000 * 60 * 60 * 24))
}

function getQuizStats() {
  try { return JSON.parse(localStorage.getItem('dashboard_quizStats') || '{"quizAttempts":0,"quizCorrect":0}') }
  catch { return { quizAttempts: 0, quizCorrect: 0 } }
}
function saveQuizStats(s) { localStorage.setItem('dashboard_quizStats', JSON.stringify(s)) }

const partOfSpeechColors = {
  adjective: 'text-purple-400',
  noun:      'text-blue-400',
  verb:      'text-green-400',
  adverb:    'text-amber-400',
}

export default function WordWidget() {
  const [mode, setMode] = useState('learn') // 'learn' | 'quiz'

  const [stats, setStats] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dashboard_wordStats') || '{"known":0,"new":0}') }
    catch { return { known: 0, new: 0 } }
  })
  const [voted, setVoted] = useState(() => {
    const today = new Date().toISOString().split('T')[0]
    return localStorage.getItem('dashboard_wordVoteDate') === today
  })

  // Quiz state
  const [quizStats, setQuizStats] = useState(getQuizStats)
  const [guess,     setGuess]     = useState('')
  const [revealed,  setRevealed]  = useState(false)
  const [isCorrect, setIsCorrect] = useState(null)
  const inputRef = useRef(null)

  const dayIndex = getDayOfYear() % vocabulary.length
  const word = vocabulary[dayIndex]

  // Blank the word in the example sentence (case-insensitive)
  const blankExample = word.example.replace(
    new RegExp(word.word, 'gi'),
    '______'
  )

  function handleVote(knew) {
    const today = new Date().toISOString().split('T')[0]
    if (localStorage.getItem('dashboard_wordVoteDate') === today) return
    const newStats = {
      known: stats.known + (knew ? 1 : 0),
      new:   stats.new   + (knew ? 0 : 1),
    }
    setStats(newStats)
    localStorage.setItem('dashboard_wordStats', JSON.stringify(newStats))
    localStorage.setItem('dashboard_wordVoteDate', today)
    setVoted(true)
  }

  function handleReveal() {
    if (revealed) return
    const correct = guess.trim().toLowerCase() === word.word.toLowerCase()
    const newQS = {
      quizAttempts: quizStats.quizAttempts + 1,
      quizCorrect:  quizStats.quizCorrect  + (correct ? 1 : 0),
    }
    saveQuizStats(newQS)
    setQuizStats(newQS)
    setIsCorrect(correct)
    setRevealed(true)
  }

  function switchMode(m) {
    setMode(m)
    setGuess('')
    setRevealed(false)
    setIsCorrect(null)
  }

  const quizAccuracy = quizStats.quizAttempts > 0
    ? Math.round((quizStats.quizCorrect / quizStats.quizAttempts) * 100)
    : null

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">📖</span>
          <h2 className="font-semibold text-slate-100">Word of the Day</h2>
        </div>
        {/* Mode toggle */}
        <div className="flex bg-slate-700 rounded-lg p-0.5 gap-0.5">
          {['Learn', 'Quiz'].map(m => (
            <button key={m}
              onClick={() => switchMode(m.toLowerCase())}
              className={`px-2.5 py-0.5 rounded-md text-xs font-medium transition-colors ${
                mode === m.toLowerCase()
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >{m}</button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 flex-1">

        {/* ── Learn mode ─────────────────────────────────────── */}
        {mode === 'learn' && (
          <>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-bold text-slate-100">{word.word}</span>
              <span className="text-sm text-slate-400 font-mono">{word.pronunciation}</span>
              <span className={`text-xs font-semibold ${partOfSpeechColors[word.partOfSpeech] || 'text-slate-400'}`}>
                {word.partOfSpeech}
              </span>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">{word.definition}</p>

            <div className="bg-slate-700/50 rounded-lg px-3 py-2">
              <p className="text-xs text-slate-400 italic leading-relaxed">"{word.example}"</p>
            </div>
          </>
        )}

        {/* ── Quiz mode ──────────────────────────────────────── */}
        {mode === 'quiz' && (
          <>
            <p className="text-sm text-slate-300 leading-relaxed">{word.definition}</p>

            <div className="bg-slate-700/50 rounded-lg px-3 py-2">
              <p className="text-xs text-slate-400 italic leading-relaxed">"{blankExample}"</p>
            </div>

            {/* Input + reveal */}
            {!revealed ? (
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={guess}
                  onChange={e => setGuess(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleReveal()}
                  placeholder="Type the word…"
                  className="flex-1 rounded-lg bg-slate-700 border border-slate-600 text-slate-200 text-sm px-3 py-1.5 focus:outline-none focus:border-blue-400 placeholder:text-slate-500"
                />
                <button
                  onClick={handleReveal}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
                >
                  Reveal
                </button>
              </div>
            ) : (
              <div className={`animate-reveal rounded-lg px-3 py-2 border ${
                isCorrect
                  ? 'bg-green-900/30 border-green-700'
                  : 'bg-red-900/30 border-red-700'
              }`}>
                <p className={`text-sm font-bold ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                  {isCorrect ? '✓ Correct!' : '✗ Not quite'}
                </p>
                {!isCorrect && (
                  <p className="text-sm text-slate-300 mt-0.5">
                    Answer: <span className="font-semibold text-slate-100">{word.word}</span>
                  </p>
                )}
              </div>
            )}

            {/* Quiz accuracy */}
            {quizAccuracy !== null && (
              <p className="text-xs text-slate-500">
                Quiz accuracy:{' '}
                <span className={quizAccuracy >= 70 ? 'text-green-400' : 'text-amber-400'}>
                  {quizAccuracy}%
                </span>
                <span className="ml-1">({quizStats.quizCorrect}/{quizStats.quizAttempts})</span>
              </p>
            )}
          </>
        )}

        {/* ── Vote + stats (both modes) ──────────────────────── */}
        <div className="mt-auto">
          {!voted ? (
            <div className="flex gap-2">
              <button
                onClick={() => handleVote(true)}
                className="flex-1 rounded-lg bg-green-700 hover:bg-green-600 text-white text-xs py-1.5 font-medium transition-colors"
              >
                ✓ I knew this one
              </button>
              <button
                onClick={() => handleVote(false)}
                className="flex-1 rounded-lg bg-slate-600 hover:bg-slate-500 text-white text-xs py-1.5 font-medium transition-colors"
              >
                ✦ New to me
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-500 text-center">Vote recorded for today</p>
          )}

          <div className="flex justify-between text-xs text-slate-500 mt-2 pt-2 border-t border-slate-700">
            <span>✓ Known: <span className="text-green-400 font-medium">{stats.known}</span></span>
            <span>✦ New: <span className="text-blue-400 font-medium">{stats.new}</span></span>
            <span>Total: <span className="text-slate-300 font-medium">{stats.known + stats.new}</span></span>
          </div>
        </div>
      </div>
    </div>
  )
}
