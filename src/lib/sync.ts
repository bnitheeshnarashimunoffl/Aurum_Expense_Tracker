// Cross-instance cache invalidation. Every screen mounts its own copy of the data
// hooks, so a mutation made in one place (e.g. the Add Transaction sheet) has to
// tell every other live hook instance to refetch — otherwise the Dashboard keeps
// showing stale numbers until a full reload.
type Table = 'transactions' | 'categories' | 'quick_add_presets' | 'budgets'

const listeners = new Map<Table, Set<() => void>>()

export function subscribe(table: Table, fn: () => void): () => void {
  let set = listeners.get(table)
  if (!set) {
    set = new Set()
    listeners.set(table, set)
  }
  set.add(fn)
  return () => {
    set.delete(fn)
  }
}

export function notify(table: Table) {
  listeners.get(table)?.forEach((fn) => fn())
}
