// The salt/hash pair is module-agnostic, so it lives in @/lib/pin now that Vigil
// gates its past-day edits the same way. Re-exported here so Kindle's imports stand.
export * from '@/lib/pin'
