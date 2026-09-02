import { highlightSegments, TYPE_LABEL, type SearchHit } from '../lib/search'
import { formatStamp } from '../lib/time'
import { EmptyState, TagChip } from './Primitives'
import { SectionHeading } from './ListRows'
import type { ItemType, Tag } from '../lib/types'

interface SearchResultsProps {
  query: string
  hits: SearchHit[]
  tags: Tag[]
  activeTagIds: string[]
  onToggleTag: (tagId: string) => void
  onOpen: (type: ItemType, id: string) => void
  /** Text for the empty result, so the secret section can speak in its own voice. */
  emptyBody?: string
}

/** Marks the matched runs without building HTML — the text includes the user's own
 *  note bodies, so nothing here goes near dangerouslySetInnerHTML. */
function Highlight({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightSegments(text, query).map((segment, i) =>
        segment.match ? (
          <mark key={i}>
            {segment.text}
          </mark>
        ) : (
          <span key={i}>{segment.text}</span>
        )
      )}
    </>
  )
}

const GROUPS: ItemType[] = ['todo', 'note', 'voice']

export default function SearchResults({
  query,
  hits,
  tags,
  activeTagIds,
  onToggleTag,
  onOpen,
  emptyBody,
}: SearchResultsProps) {
  const active = new Set(activeTagIds)

  return (
    <div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-1 pt-3">
          {tags.map((tag) => (
            <TagChip key={tag.id} label={tag.label} active={active.has(tag.id)} onClick={() => onToggleTag(tag.id)} />
          ))}
        </div>
      )}

      {hits.length === 0 ? (
        <EmptyState
          title="Nothing matches that"
          body={emptyBody ?? 'Chronicle searches to-do titles and details, note titles and bodies, and voice transcripts.'}
        />
      ) : (
        GROUPS.map((type) => {
          const group = hits.filter((hit) => hit.type === type)
          if (group.length === 0) return null
          return (
            <section key={type}>
              <SectionHeading count={group.length}>{TYPE_LABEL[type]}</SectionHeading>
              <div>
                {group.map((hit) => (
                  <button
                    key={`${hit.type}-${hit.id}`}
                    type="button"
                    onClick={() => onOpen(hit.type, hit.id)}
                    className="flex w-full flex-col gap-1 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-inset"
                    style={{ borderBottom: '1px solid var(--chr-rule)' }}
                  >
                    <span className="text-[15px] leading-snug text-ivory">
                      <Highlight text={hit.title || 'Untitled'} query={query} />
                    </span>
                    {hit.snippet && (
                      <span className="line-clamp-2 text-[13px] leading-relaxed text-ivoryDim">
                        <Highlight text={hit.snippet} query={query} />
                      </span>
                    )}
                    <span className="text-[11.5px] text-ivoryDim">{formatStamp(hit.timestamp)}</span>
                  </button>
                ))}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}
