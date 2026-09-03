import Walkthrough from './Walkthrough'
import { WALKTHROUGHS } from './steps'
import { useWalkthrough } from './useWalkthrough'
import type { ModuleKey } from './types'

/**
 * The one line a module has to add to get its walkthrough: state, content and
 * overlay wired together.
 *
 *   <ModuleWalkthrough module="kindle" ready={!loading} />
 *
 * `ready` matters more than it looks. Each walkthrough points at real elements,
 * and a module's screen is a spinner for the first few hundred milliseconds —
 * opening before the grid exists would spotlight nothing and read as broken.
 */
export default function ModuleWalkthrough({ module, ready = true }: { module: ModuleKey; ready?: boolean }) {
  const definition = WALKTHROUGHS[module]
  const { open, finish, skip } = useWalkthrough(module, ready)

  return <Walkthrough module={module} steps={definition.steps} open={open} onFinish={finish} onSkip={skip} />
}
