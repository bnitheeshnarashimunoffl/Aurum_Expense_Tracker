import { useToast } from '@/hooks/useToast'
import LoadingRing from '@/components/LoadingRing'
import { useTopics } from '../hooks/useTopics'
import { treeTotals } from '../lib/tree'
import TopicTree from '../components/TopicTree'
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
        <TopicTree
          tree={tree}
          onSetCompleted={guard(setSubtopicsCompleted, "Couldn't save that change")}
          onAddCategory={addCategory}
          onAddSubject={addSubject}
          onAddSubtopic={addSubtopic}
          onDeleteCategory={guard(deleteCategory, "Couldn't delete that category")}
          onDeleteSubject={guard(deleteSubject, "Couldn't delete that subject")}
          onDeleteSubtopic={guard(deleteSubtopic, "Couldn't delete that subtopic")}
        />
      )}

      <VigilToast message={message} />
    </div>
  )
}
