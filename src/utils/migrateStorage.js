/**
 * One-time localStorage key migrations — runs on every app load but is a no-op
 * once migration is complete (old key no longer exists).
 *
 * Old keys used the legacy naming (no prefix, or wrong prefix).
 * New keys all use the `dashboard_` prefix.
 */
const MIGRATIONS = [
  ['wordStats',    'dashboard_wordStats'],
  ['wordVoteDate', 'dashboard_wordVoteDate'],
  ['stockTickers', 'dashboard_stockTickers'],
  ['germanStats',  'dashboard_germanStats'],
  ['germanStreak', 'dashboard_germanStreak'],
  ['darkMode',     'dashboard_darkMode'],
]

export function migrateStorage() {
  MIGRATIONS.forEach(([oldKey, newKey]) => {
    const oldVal = localStorage.getItem(oldKey)
    if (oldVal === null) return                          // already migrated or never set
    if (localStorage.getItem(newKey) === null) {
      localStorage.setItem(newKey, oldVal)              // copy to new key
    }
    localStorage.removeItem(oldKey)                     // delete old key
    console.log(`[storage] migrated: ${oldKey} → ${newKey}`)
  })
}
