import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useGuestStart } from '../hooks/useGuestStart'
import AuthOptions from '../components/AuthOptions'

interface LocationState { from?: { pathname?: string } }

/** Codes the server's Google/Seznam callback puts in /login?error=... */
const SSO_ERRORS: Record<string, string> = {
  cancelled: 'Přihlášení bylo zrušeno.',
  state: 'Přihlášení vypršelo nebo bylo přerušeno. Zkus to prosím znovu.',
  provider: 'Účet se nepodařilo ověřit. Zkus to prosím znovu, nebo se přihlas jinak.',
  unavailable: 'Tento způsob přihlášení teď není dostupný.',
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const ssoErrorCode = new URLSearchParams(location.search).get('error')
  const ssoError = ssoErrorCode ? SSO_ERRORS[ssoErrorCode] ?? SSO_ERRORS.provider : null

  function goBack() {
    const to = (location.state as LocationState | null)?.from?.pathname ?? '/app'
    navigate(to, { replace: true })
  }

  const guest = useGuestStart(goBack)

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="bg-white p-8 rounded-lg shadow-sm border border-neutral-200 w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-6">Přihlášení</h1>
        {ssoError && <div role="alert" className="text-sm text-red-600 mb-4">{ssoError}</div>}
        <AuthOptions onSuccess={goBack} />
        <div className="mt-6 pt-4 border-t border-neutral-200">
          {guest.error && <div role="alert" className="text-sm text-red-600 mb-3">{guest.error}</div>}
          <button type="button" onClick={guest.start} disabled={guest.busy}
            className="w-full border border-neutral-300 rounded py-2 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
            {guest.busy ? 'Ověřuji…' : 'Pokračovat bez přihlášení'}
          </button>
          {guest.captcha}
          <p className="mt-4 text-xs text-neutral-500 text-center">
            <Link to="/ochrana-osobnich-udaju" className="hover:underline">Ochrana osobních údajů</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
