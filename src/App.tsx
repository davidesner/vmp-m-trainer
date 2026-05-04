import { HashRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Home from './routes/Home'
import Test from './routes/Test'
import Practice from './routes/Practice'
import Weak from './routes/Weak'
import Stats from './routes/Stats'
import Settings from './routes/Settings'

export default function App() {
  return (
    <HashRouter>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/test" element={<Test />} />
            <Route path="/practice" element={<Practice />} />
            <Route path="/weak" element={<Weak />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}
