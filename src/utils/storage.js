import { applyEdits, blankListing, pruneEdits } from './listing.js'

const STORAGE_KEY = 'apartment-viewer/state/v1'

// Per-listing app state shape (local changes not yet saved to listings.json):
// {
//   status: 'new' | 'accepted' | 'rejected',
//   appointment: { dateTime: string|null },
//   notes: string,
//   edits: { ...fields that differ from the seed listing },
//   custom?: true,       // listing was added by hand in the app
//   createdAt?: number,  // ms timestamp, manual listings only
// }

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch (err) {
    console.error('Failed to load apartment-viewer state from localStorage', err)
    return {}
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (err) {
    console.error('Failed to save apartment-viewer state to localStorage', err)
  }
}

// Defaults come from the seed record, so status/notes/appointment saved into
// listings.json show up without any local state.
export function defaultEntryState(seed) {
  return {
    status: seed?.seedStatus || 'new',
    appointment: { dateTime: seed?.appointment?.dateTime ?? null },
    notes: seed?.notes || '',
    edits: {},
  }
}

// Stored entries from before a field existed get the defaults filled in.
export function resolveEntry(seed, stored) {
  return { ...defaultEntryState(seed), ...(stored || {}) }
}

// True when an entry holds anything that isn't already in listings.json.
// `inFile` is false for manual listings that haven't been exported yet.
export function isDirty(seed, entry, inFile = true) {
  if (!inFile) return true
  const d = defaultEntryState(seed)
  return (
    entry.status !== d.status ||
    (entry.notes || '') !== d.notes ||
    (entry.appointment?.dateTime || null) !== d.appointment.dateTime ||
    Object.keys(pruneEdits(seed, entry.edits)).length > 0
  )
}

// Clean local state against the current listings.json: edits that now match
// the file are dropped, entries with nothing left are removed, and manual
// listings that made it into the file stop being "manual" locally.
export function pruneState(seedListings, state) {
  const byId = new Map(seedListings.map((l) => [l.id, l]))
  const next = {}
  Object.entries(state || {}).forEach(([id, stored]) => {
    const seed = byId.get(id)
    if (!seed) {
      if (stored && stored.custom) next[id] = stored
      return
    }
    const { custom, createdAt, ...entry } = resolveEntry(seed, stored)
    const pruned = { ...entry, edits: pruneEdits(seed, entry.edits) }
    if (isDirty(seed, pruned)) next[id] = pruned
  })
  return next
}

// Seed listings plus manually added ones (newest first, ahead of the seeds).
// A manual listing's base record is a blank template; its data lives in edits.
// Ids already in the seed file win, so a just-saved manual listing can't
// appear twice.
export function allSeeds(seedListings, state) {
  const seedIds = new Set(seedListings.map((l) => l.id))
  const manual = Object.entries(state)
    .filter(([id, entry]) => entry && entry.custom && !seedIds.has(id))
    .sort(([, a], [, b]) => (b.createdAt || 0) - (a.createdAt || 0))
    .map(([id]) => blankListing(id))
  return [...manual, ...seedListings]
}

// Key order for records written to listings.json.
const RECORD_KEYS = [
  'id',
  'name',
  'address',
  'category',
  'propertyType',
  'rent',
  'bedsBaths',
  'source',
  'sourceUrl',
  'images',
  'petPolicy',
  'confirmedAmenities',
  'toVerify',
  'contact',
  'score',
  'researchNotes',
  'seedStatus',
  'notes',
  'appointment',
]

// The full dataset as it should be written to listings.json: seed records
// with local edits merged in, manual listings included, and each listing's
// current status/notes/appointment baked in.
export function buildSeedFile(seedListings, state) {
  return allSeeds(seedListings, state).map((seed) => {
    const entry = resolveEntry(seed, state[seed.id])
    const merged = {
      ...applyEdits(seed, entry.edits),
      seedStatus: entry.status,
      notes: entry.notes || '',
      appointment: { dateTime: entry.appointment?.dateTime || null },
    }
    const record = {}
    RECORD_KEYS.forEach((key) => {
      if (key in merged) record[key] = merged[key]
    })
    // Keep any fields added to the data later that aren't in RECORD_KEYS yet.
    Object.keys(merged).forEach((key) => {
      if (!(key in record)) record[key] = merged[key]
    })
    return record
  })
}
