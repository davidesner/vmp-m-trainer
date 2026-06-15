// Lightweight global signal: "there is an unfinished test running".
// Test.tsx registers itself when the user has started entering answers,
// and clears it on submit/unmount. CategoryDropdown reads it to decide
// whether to ask the user to confirm category switch.

interface State {
  inProgress: boolean
  answered: number
  total: number
  remainingSec: number
}

let state: State = { inProgress: false, answered: 0, total: 0, remainingSec: 0 }
const listeners = new Set<(s: State) => void>()

function emit() { for (const l of listeners) l(state) }

export function setTestInProgress(next: Partial<State>) {
  state = { ...state, ...next }
  emit()
}

export function clearTestInProgress() {
  state = { inProgress: false, answered: 0, total: 0, remainingSec: 0 }
  emit()
}

export function getTestInProgress(): State { return state }

export function subscribeTestInProgress(l: (s: State) => void): () => void {
  listeners.add(l)
  return () => { listeners.delete(l) }
}
