/**
 * Where the registration captcha widget will render. UI-only placeholder until
 * the provider is chosen and the backend verifies the token.
 */
export default function CaptchaSlot() {
  return (
    <div data-captcha-slot
      className="h-16 rounded border border-dashed border-neutral-300 bg-neutral-50 flex items-center justify-center text-xs text-neutral-500">
      Ověření, že nejsi robot (připravujeme)
    </div>
  )
}
