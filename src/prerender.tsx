// Server-side entry used only at build time (see scripts/prerender.mjs): renders the public landing page to
// static HTML so search engines and link previews get real content instead of an empty <div id="root">.
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { ActiveTestProvider } from './hooks/useActiveTest'
import Landing from './routes/Landing'

export function renderLanding(): string {
  // No session exists at build time, so this is the variant a first-time visitor sees.
  return renderToString(
    <AuthProvider>
      <ActiveTestProvider>
        <MemoryRouter initialEntries={['/']}>
          <Landing />
        </MemoryRouter>
      </ActiveTestProvider>
    </AuthProvider>,
  )
}
