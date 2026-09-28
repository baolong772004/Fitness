import cors from 'cors'
import express from 'express'

const plans = {
  strength: { title: 'Beginner Strength Builder', duration: 35, exercises: ['Goblet squat — 3 × 10', 'Push-up — 3 × 8', 'Dumbbell row — 3 × 10', 'Plank — 3 × 30 sec'] },
  'weight-loss': { title: 'Full Body Cardio Circuit', duration: 30, exercises: ['Jumping jacks — 3 × 45 sec', 'Bodyweight lunge — 3 × 12', 'Mountain climber — 3 × 30 sec', 'Walk — 10 min'] },
  mobility: { title: 'Daily Mobility Flow', duration: 20, exercises: ['Cat-cow — 2 × 10', 'Hip flexor stretch — 2 × 30 sec', 'Thoracic rotation — 2 × 8', 'Child pose — 2 × 45 sec'] }
}

const app = express()
app.use(cors())
app.use(express.json())
app.get('/api/health', (_request, response) => response.json({ status: 'ok', service: 'fitness-ai-module' }))
app.post('/api/suggestions', (request, response) => {
  const { goal = 'strength' } = request.body
  response.json(plans[goal] ?? plans.strength)
})
app.listen(4001, () => console.log('AI module listening on http://localhost:4001'))

