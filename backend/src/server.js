import cors from 'cors'
import express from 'express'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/api/health', (_request, response) => response.json({ status: 'ok', service: 'fitness-backend' }))
app.get('/api/workouts', (_request, response) => response.json([
  { id: 1, name: 'Full Body Strength', duration: 45 },
  { id: 2, name: 'Morning Mobility', duration: 20 }
]))

app.listen(4000, () => console.log('Backend listening on http://localhost:4000'))

