// Seek only into obsolete snapshot ranges. A pair of <> predicates scans the
// retained register too, even when there is nothing to remove.
export const REGISTER_CLEANUP_QUERY = `DELETE FROM sponsors WHERE rowid IN (
  SELECT rowid FROM sponsors WHERE snapshot < ?
  UNION ALL SELECT rowid FROM sponsors WHERE snapshot > ? AND snapshot < ?
  UNION ALL SELECT rowid FROM sponsors WHERE snapshot > ?
) AND EXISTS (
  SELECT 1 FROM metadata WHERE key='register' AND json_extract(value,'$.snapshot')=?
)`;

export function registerCleanupStatement(DB, snapshot, previousSnapshot = snapshot, ownership = null) {
  const [lower, upper] = [snapshot, previousSnapshot].sort();
  // The same statement guards against an older invocation cleaning up after a
  // different snapshot has become current. No customer tables are touched.
  const guard = ownership ? ` AND EXISTS (SELECT 1 FROM metadata WHERE key='register' AND value=?)
    AND EXISTS (SELECT 1 FROM feed_locks WHERE name='worker-register' AND owner=? AND expires>?)` : '';
  return DB.prepare(REGISTER_CLEANUP_QUERY + guard).bind(lower, lower, upper, upper, snapshot,
    ...(ownership ? [ownership.value, ownership.owner, ownership.now] : []));
}
