import { useState } from 'react'
import { useToast } from '@/hooks/useToast'
import LoadingRing from '@/components/LoadingRing'
import { useTopics } from '../hooks/useTopics'
import { treeTotals } from '../lib/tree'
import TopicTree from '../components/TopicTree'
import HourglassIcon from '../components/HourglassIcon'
import ModuleEmptyState from '@/components/ModuleEmptyState'
import VigilToast from '../components/VigilToast'

export default function Topics() {
  const {
    tree,
    loading,
    addCategory,
    addSubject,
    addSubtopic,
    setSubtopicsCompleted,
    deleteCategory,
    deleteSubject,
    deleteSubtopic,
  } = useTopics()
  const { message, showToast } = useToast()
  // Bumped by the empty state's button to spring the tree's own "Add category"
  // field open, so the one thing to do next is one tap away rather than a
  // second thing to find.
  const [addCategoryToken, setAddCategoryToken] = useState(0)

  const { done, total } = treeTotals(tree)
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)

  function guard<T extends unknown[]>(fn: (...args: T) => Promise<unknown>, failure: string) {
    return (...args: T) => {
      fn(...args).catch(() => showToast(failure))
    }
  }

  return (
    <div className="px-4 pt-4">
      <header className="mb-5">
        <h1 className="font-display text-2xl font-bold text-vigilInk">Topics</h1>
        <p className="text-xs text-vigilInkSoft">
          {total === 0 ? 'Add a category to start tracking' : `${done} of ${total} subtopics done · ${pct}%`}
        </p>
      </header>

      {loading ? (
        <LoadingRing label="Loading topics" />
      ) : (
        <>
          {/* The tree carries its own inline "Add category" affordance, but on an
              empty screen that is three words and a plus sign — which explains
              neither what the three levels are for nor why building the tree is
              worth the trouble. The empty state goes ABOVE the tree rather than
              instead of it, so the field its button opens is directly beneath.
              Once one category exists, this never appears again. */}
          {tree.length === 0 && (
            <div className="mb-4">
              <ModuleEmptyState
                tone="vigil"
                icon={<HourglassIcon size={30} />}
                title="Your syllabus, as a tree"
                body="Three levels: a category holds subjects, a subject holds the subtopics you actually revise. Tick the subtopics and everything above them fills in on its own."
                action={{ label: 'Add your first category', onClick: () => setAddCategoryToken((n) => n + 1) }}
              />
            </div>
          )}

          <TopicTree
            tree={tree}
            addCategoryToken={addCategoryToken}
            onSetCompleted={guard(setSubtopicsCompleted, "Couldn't save that change")}
            onAddCategory={addCategory}
            onAddSubject={addSubject}
            onAddSubtopic={addSubtopic}
            onDeleteCategory={guard(deleteCategory, "Couldn't delete that category")}
            onDeleteSubject={guard(deleteSubject, "Couldn't delete that subject")}
            onDeleteSubtopic={guard(deleteSubtopic, "Couldn't delete that subtopic")}
          />
        </>
      )}

      <VigilToast message={message} />
    </div>
  )
}
