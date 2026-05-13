import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import RequireAuth from './components/RequireAuth'
import Sidebar from './components/Sidebar'
import Home from './routes/Home'
import Test from './routes/Test'
import Practice from './routes/Practice'
import Weak from './routes/Weak'
import Stats from './routes/Stats'
import Settings from './routes/Settings'
import Login from './routes/Login'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto pt-14 md:pt-0">{children}</main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RequireAuth><Shell><Home /></Shell></RequireAuth>} />
          <Route path="/test" element={<RequireAuth><Shell><Test /></Shell></RequireAuth>} />
          <Route path="/practice" element={<RequireAuth><Shell><Practice /></Shell></RequireAuth>} />
          <Route path="/weak" element={<RequireAuth><Shell><Weak /></Shell></RequireAuth>} />
          <Route path="/stats" element={<RequireAuth><Shell><Stats /></Shell></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><Shell><Settings /></Shell></RequireAuth>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
