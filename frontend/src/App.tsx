import { useState } from 'react'

type Suggestion = { title: string; duration: number; exercises: string[] }

export default function App() {
  const [goal, setGoal] = useState('strength')
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const [loading, setLoading] = useState(false)

  async function getSuggestion() {
    setLoading(true)
    try {
      const response = await fetch('http://localhost:4001/api/suggestions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, level: 'beginner' })
      })
      setSuggestion(await response.json())
    } catch {
      setSuggestion({ title: 'AI service unavailable', duration: 0, exercises: ['Start the AI module, then try again.'] })
    } finally { setLoading(false) }
  }

  return <main>
    <section className="hero">
      <p className="eyebrow">FITNESS PLATFORM</p>
      <h1>Train with a plan.</h1>
      <p>Choose your goal and receive a simple personalized workout.</p>
      <div className="controls">
        <select value={goal} onChange={(event) => setGoal(event.target.value)}>
          <option value="strength">Build strength</option>
          <option value="weight-loss">Lose weight</option>
          <option value="mobility">Improve mobility</option>
        </select>
        <button onClick={getSuggestion} disabled={loading}>{loading ? 'Creating…' : 'Get workout'}</button>
      </div>
    </section>
    {suggestion && <section className="card">
      <span>{suggestion.duration} MINUTES</span><h2>{suggestion.title}</h2>
      <ul>{suggestion.exercises.map((exercise) => <li key={exercise}>{exercise}</li>)}</ul>
    </section>}
  </main>
}

