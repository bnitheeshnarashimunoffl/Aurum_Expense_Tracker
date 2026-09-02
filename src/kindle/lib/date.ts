// Vigil needs the same week/month math Kindle already had, so it moved to
// @/lib/date alongside the other shared helpers. Kindle keeps importing from here
// (and re-exports the shared set) so none of its call sites had to change.
export * from '@/lib/date'
