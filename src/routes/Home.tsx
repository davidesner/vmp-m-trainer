import { Link } from 'react-router-dom'
import { useProgress } from '../hooks/useProgress'

export default function Home() {
  const { store } = useProgress()
  const recent = store.testHistory.slice(0, 5)
  return (
    <div className="p-8 max-w-4xl">
      <h2 className="text-2xl font-bold mb-6">Připraven na zkoušku?</h2>

      <Link to="/test" className="block bg-primary hover:bg-primary-dark text-white rounded-lg p-6 mb-6 transition">
        <div className="text-xs uppercase tracking-wide opacity-90">▶ Hlavní akce</div>
        <div className="text-2xl font-bold mt-1">Spustit ostrý test</div>
        <div className="text-sm opacity-90 mt-1">35 otázek · 30 minut · min. 30 bodů</div>
      </Link>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Link to="/practice" className="bg-white border border-neutral-200 rounded-lg p-4 hover:border-primary transition">
          <div className="text-2xl">📚</div>
          <div className="font-semibold mt-1">Procvičování</div>
          <div className="text-xs text-neutral-500">oblasti / mix slabin</div>
        </Link>
        <Link to="/weak" className="bg-white border border-neutral-200 rounded-lg p-4 hover:border-primary transition">
          <div className="text-2xl">🎯</div>
          <div className="font-semibold mt-1">Slabiny</div>
          <div className="text-xs text-neutral-500">opakuj co pleteš</div>
        </Link>
        <Link to="/stats" className="bg-white border border-neutral-200 rounded-lg p-4 hover:border-primary transition">
          <div className="text-2xl">📊</div>
          <div className="font-semibold mt-1">Statistiky</div>
          <div className="text-xs text-neutral-500">úspěšnost</div>
        </Link>
      </div>

      {recent.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Posledních 5 testů</div>
          <div className="flex flex-col gap-2">
            {recent.map((t, i) => {
              const pct = (t.score / t.total) * 100
              const passed = t.score >= 30
              return (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="text-neutral-500 w-24">{new Date(t.at).toLocaleString()}</span>
                  <div className="flex-1 bg-neutral-100 h-3 rounded">
                    <div className={`h-3 rounded ${passed ? 'bg-primary' : 'bg-danger'}`} style={{ width: `${pct}%` }}/>
                  </div>
                  <span className="font-semibold tabular-nums">{t.score}/{t.total}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
