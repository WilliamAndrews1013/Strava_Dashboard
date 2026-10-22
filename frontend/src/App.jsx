import ActivitiesPage from './components/ActivitiesPage'
import './App.css'

const NGORK_API_URL = "https://wasting-casually-translate.ngrok-free.dev/"

function App() {
  return (
    <main className="page">
      <h1 className="page-title">Activity Dashboard</h1>

      <ActivitiesPage />
    </main>
  )
}

export default App
