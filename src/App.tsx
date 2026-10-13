import { BrowserRouter, Routes, Route } from 'react-router-dom'
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
import { useAuth } from './hooks/useAuth'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto pt-14 md:pt-0">{children}</main>
    </div>
  )
}

// Logged-out visitors get the public landing page at "/", everyone else (guests included) the dashboard.
function HomeOrLanding() {
  const { user, loading } = useAuth()
  if (loading) return <div className="p-8 text-sm text-neutral-500">Načítám…</div>
  if (!user) return <Landing />
  return <Shell><Home /></Shell>
}

export default function App() {
  return (
    <AuthProvider>
      <ActiveTestProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<HomeOrLanding />} />
          <Route path="/test" element={<RequireAuth><Shell><Test /></Shell></RequireAuth>} />
          <Route path="/practice" element={<RequireAuth><Shell><Practice /></Shell></RequireAuth>} />
          <Route path="/weak" element={<RequireAuth><Shell><Weak /></Shell></RequireAuth>} />
          <Route path="/stats" element={<RequireAuth><Shell><Stats /></Shell></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><Shell><Settings /></Shell></RequireAuth>} />
        </Routes>
      </BrowserRouter>
      </ActiveTestProvider>
    </AuthProvider>
  )
}
