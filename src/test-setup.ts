import '@testing-library/jest-dom'

// Node 25+ has its own global localStorage/sessionStorage, which is undefined unless Node runs with
// --localstorage-file, and it shadows jsdom's. Put jsdom's storage back so tests (and app code) get a real one.
declare const jsdom: { window: Window } | undefined
for (const name of ['localStorage', 'sessionStorage'] as const) {
  if (globalThis[name] === undefined && typeof jsdom !== 'undefined') {
    Object.defineProperty(globalThis, name, { value: jsdom.window[name], configurable: true, writable: true })
  }
}
