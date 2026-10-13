import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { ActiveTestProvider } from './hooks/useActiveTest'
import RequireAuth from './components/RequireAuth'
import Sidebar from './components/Sidebar'
import Home from './routes/Home'
import Test from './routes/Test'
import Practice from './routes/Practice'
import Weak from './routes/Weak'
import Stats from './routes/Stats'
import Settings from './routes/Settings'
import Login from './routes/Login'
import Register from './routes/Register'
import Landing from './routes/Landing'

function Shell() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto pt-14 md:pt-0"><Outlet /></main>
    </div>
  )
}

// Pre-/app URLs, kept so old bookmarks still land in the right place.
const LEGACY_PATHS = ['test', 'practice', 'weak', 'stats', 'settings']

export default function App() {
  return (
    <AuthProvider>
      <ActiveTestProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<Landing />} />
          <Route path="/app" element={<RequireAuth><Shell /></RequireAuth>}>
            <Route index element={<Home />} />
            <Route path="test" element={<Test />} />
            <Route path="practice" element={<Practice />} />
            <Route path="weak" element={<Weak />} />
            <Route path="stats" element={<Stats />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          {LEGACY_PATHS.map(p => <Route key={p} path={`/${p}`} element={<Navigate to={`/app/${p}`} replace />} />)}
        </Routes>
      </BrowserRouter>
      </ActiveTestProvider>
    </AuthProvider>
  )
}
