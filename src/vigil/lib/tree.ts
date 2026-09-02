import type { VigilCategory, VigilSubject, VigilSubtopic } from './types'

/**
 * `empty` — nothing to track yet (no subtopics beneath it), so it cannot be checked.
 * `none` / `partial` / `complete` — derived purely from the subtopics beneath.
 */
export type NodeState = 'empty' | 'none' | 'partial' | 'complete'

export interface SubjectNode {
  subject: VigilSubject
  subtopics: VigilSubtopic[]
  done: number
  total: number
  ratio: number
  state: NodeState
}

export interface CategoryNode {
  category: VigilCategory
  subjects: SubjectNode[]
  done: number
  total: number
  ratio: number
  state: NodeState
}

function stateOf(done: number, total: number, hasEmptyChild = false): NodeState {
  if (total === 0) return 'empty'
  if (done === 0) return 'none'
  // An otherwise-finished category still reads `partial` while it holds a subject
  // with no subtopics — there is real structure in it that isn't tracked yet, and
  // calling that "complete" would be a lie the user can see on screen.
  if (done === total) return hasEmptyChild ? 'partial' : 'complete'
  return 'partial'
}

/**
 * Builds the whole tree with every parent's progress derived from its leaves.
 *
 * This is what makes the "upward cascade" automatic rather than a second set of
 * writes to keep in sync: checking the last subtopic under a subject makes that
 * subject complete because there is no other definition of complete, and
 * unchecking any one subtopic reverts its subject (and its category) for exactly
 * the same reason. Nothing to double-count, nothing to get out of step.
 */
export function buildTree(
  categories: VigilCategory[],
  subjects: VigilSubject[],
  subtopics: VigilSubtopic[]
): CategoryNode[] {
  const subtopicsBySubject = new Map<string, VigilSubtopic[]>()
  for (const subtopic of subtopics) {
    const list = subtopicsBySubject.get(subtopic.subject_id)
    if (list) list.push(subtopic)
    else subtopicsBySubject.set(subtopic.subject_id, [subtopic])
  }

  const subjectsByCategory = new Map<string, VigilSubject[]>()
  for (const subject of subjects) {
    const list = subjectsByCategory.get(subject.category_id)
    if (list) list.push(subject)
    else subjectsByCategory.set(subject.category_id, [subject])
  }

  const byPosition = <T extends { position: number; created_at: string }>(a: T, b: T) =>
    a.position - b.position || a.created_at.localeCompare(b.created_at)

  return [...categories].sort(byPosition).map((category) => {
    const subjectNodes: SubjectNode[] = (subjectsByCategory.get(category.id) ?? [])
      .sort(byPosition)
      .map((subject) => {
        const leaves = (subtopicsBySubject.get(subject.id) ?? []).sort(byPosition)
        const done = leaves.filter((s) => s.completed).length
        const total = leaves.length
        return {
          subject,
          subtopics: leaves,
          done,
          total,
          ratio: total === 0 ? 0 : done / total,
          state: stateOf(done, total),
        }
      })

    const done = subjectNodes.reduce((sum, s) => sum + s.done, 0)
    const total = subjectNodes.reduce((sum, s) => sum + s.total, 0)
    return {
      category,
      subjects: subjectNodes,
      done,
      total,
      ratio: total === 0 ? 0 : done / total,
      state: stateOf(done, total, subjectNodes.some((s) => s.state === 'empty')),
    }
  })
}

/** Every subtopic id beneath a category — the downward cascade's write set. */
export function subtopicIdsInCategory(node: CategoryNode): string[] {
  return node.subjects.flatMap((s) => s.subtopics.map((t) => t.id))
}

/** Overall completion across the whole tree, for the Topics header summary. */
export function treeTotals(tree: CategoryNode[]): { done: number; total: number } {
  return {
    done: tree.reduce((sum, c) => sum + c.done, 0),
    total: tree.reduce((sum, c) => sum + c.total, 0),
  }
}
