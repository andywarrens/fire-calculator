// Scenario persistence in localStorage. Each scenario is { name, savedAt, state }.
// `name` is the unique key (saving an existing name overwrites it). All access
// is wrapped in try/catch so a corrupt entry or a disabled store can never
// white-screen the app.

const KEY = 'fire-scenarios'

export function loadScenarios() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function persist(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* storage full or unavailable — nothing we can do, fail silently */
  }
}

export function saveScenario(name, state, now) {
  // Overwrite any existing scenario with the same name.
  const list = loadScenarios().filter((s) => s.name !== name)
  list.push({ name, savedAt: now, state })
  persist(list)
  return list
}

export function deleteScenario(name) {
  const list = loadScenarios().filter((s) => s.name !== name)
  persist(list)
  return list
}

export function mostRecent(list) {
  if (!list || !list.length) return null
  return list.reduce((a, b) => (a.savedAt > b.savedAt ? a : b))
}
