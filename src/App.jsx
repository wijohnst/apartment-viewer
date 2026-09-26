import { useEffect, useMemo, useState } from 'react'
import seedListings from './data/listings.json'
import ListingCard from './components/ListingCard.jsx'
import ListingOverlay from './components/ListingOverlay.jsx'
import ExportOverlay from './components/ExportOverlay.jsx'
import ScheduleView, { scheduleCounts } from './components/ScheduleView.jsx'
import StatusTabs from './components/StatusTabs.jsx'
import SearchBar from './components/SearchBar.jsx'
import { loadState, saveState, resolveEntry, allSeeds, isDirty, pruneState, buildSeedFile } from './utils/storage.js'
import { applyEdits, blankListing, newListingId, addressKey } from './utils/listing.js'
import { searchListings } from './utils/fuzzy.js'

const seedIds = new Set(seedListings.map((l) => l.id))

function viewFromHash() {
  return window.location.hash === '#schedule' ? 'schedule' : 'listings'
}

export default function App() {
  const [appState, setAppState] = useState(() => pruneState(seedListings, loadState()))
  const [activeTab, setActiveTab] = useState('all')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState(null)
  // id of a listing being created that hasn't been saved yet
  const [pendingNewId, setPendingNewId] = useState(null)
  const [exportOpen, setExportOpen] = useState(false)
  // 'listings' | 'schedule', mirrored in the URL hash so #schedule is linkable
  const [view, setView] = useState(viewFromHash)

  useEffect(() => {
    const onHashChange = () => setView(viewFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  function switchView(next) {
    setView(next)
    const url = next === 'schedule' ? '#schedule' : window.location.pathname + window.location.search
    window.history.replaceState(null, '', url)
  }

  useEffect(() => {
    saveState(appState)
  }, [appState])

  // If listings.json changes while the app is open (dev hot reload), drop
  // local changes the file now already contains.
  useEffect(() => {
    setAppState((prev) => pruneState(seedListings, prev))
  }, [seedListings])

  // Seed data + saved edits + app state, one object per listing.
  const items = useMemo(
    () =>
      allSeeds(seedListings, appState).map((seed) => {
        const entry = resolveEntry(seed, appState[seed.id])
        const inFile = seedIds.has(seed.id)
        return {
          seed,
          entry,
          listing: applyEdits(seed, entry.edits),
          // "custom" = added in the app and not yet exported into the file
          custom: Boolean(entry.custom) && !inFile,
          dirty: isDirty(seed, entry, inFile),
        }
      }),
    [appState],
  )

  const changedCount = useMemo(() => items.filter((item) => item.dirty).length, [items])
  const exportRecords = useMemo(
    () => (exportOpen ? buildSeedFile(seedListings, appState) : []),
    [exportOpen, appState],
  )

  function seedFor(id) {
    return seedListings.find((l) => l.id === id) || blankListing(id)
  }

  function updateEntry(id, updater) {
    setAppState((prev) => ({ ...prev, [id]: updater(resolveEntry(seedFor(id), prev[id])) }))
  }

  function deleteEntry(id) {
    setAppState((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  function startNewListing() {
    const id = newListingId()
    setPendingNewId(id)
    setOpenId(id)
  }

  function closeOverlay() {
    setOpenId(null)
    setPendingNewId(null)
  }

  // Search applies across every tab; tab counts reflect the current search.
  const matches = useMemo(() => searchListings(items, query), [items, query])

  const counts = useMemo(() => {
    const c = { all: matches.length, new: 0, accepted: 0, rejected: 0 }
    matches.forEach(({ entry }) => {
      c[entry.status] = (c[entry.status] || 0) + 1
    })
    return c
  }, [matches])

  const visible = activeTab === 'all' ? matches : matches.filter(({ entry }) => entry.status === activeTab)
  const upcomingCount = scheduleCounts(items).upcoming

  let open = null
  if (openId) {
    open = items.find((item) => item.seed.id === openId)
    if (!open && openId === pendingNewId) {
      const seed = blankListing(openId)
      open = { seed, entry: resolveEntry(seed, undefined), listing: seed, custom: true }
    }
  }
  const isNew = Boolean(open) && openId === pendingNewId

  // Another listing at the same street address, if any.
  function findDuplicate(address, selfId) {
    const key = addressKey(address)
    if (!key) return null
    const hit = items.find((item) => item.seed.id !== selfId && addressKey(item.listing.address) === key)
    return hit ? hit.listing : null
  }

  return (
    <div className="app">
      <div className="app-header">
        <h1>Salem Apartment Viewer</h1>
        <p>
          {items.length} candidates tracked locally in your browser · sourced from Apartments.com, ApartmentList,
          HotPads, Zillow, and your own additions
        </p>
      </div>

      <div className="toolbar">
        <div className="view-switch" role="tablist" aria-label="View">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'listings'}
            className={view === 'listings' ? 'active' : ''}
            onClick={() => switchView('listings')}
          >
            Listings
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'schedule'}
            className={view === 'schedule' ? 'active' : ''}
            onClick={() => switchView('schedule')}
          >
            Schedule{upcomingCount > 0 ? ` (${upcomingCount})` : ''}
          </button>
        </div>
        <div className="toolbar-row">
          <SearchBar value={query} onChange={setQuery} />
          <button type="button" className="btn primary" onClick={startNewListing}>
            + Add listing
          </button>
          <button type="button" className="btn secondary" onClick={() => setExportOpen(true)}>
            Export{changedCount > 0 ? ` · ${changedCount} changed` : ''}
          </button>
        </div>
        {view === 'listings' && <StatusTabs active={activeTab} counts={counts} onChange={setActiveTab} />}
      </div>

      {view === 'schedule' && query.trim() && (
        <p className="result-summary">Showing appointments for listings matching “{query.trim()}”</p>
      )}

      {view === 'listings' && query.trim() && (
        <p className="result-summary">
          {visible.length} {visible.length === 1 ? 'match' : 'matches'} for “{query.trim()}”, best first
        </p>
      )}

      {view === 'schedule' ? (
        <ScheduleView items={matches} onOpen={setOpenId} />
      ) : visible.length === 0 ? (
        <div className="empty-state">{query.trim() ? 'No listings match that search.' : 'Nothing here yet.'}</div>
      ) : (
        <div className="grid">
          {visible.map(({ listing, entry, seed, custom }) => (
            <ListingCard
              key={seed.id}
              listing={listing}
              status={entry.status}
              edited={!custom && Object.keys(entry.edits || {}).length > 0}
              onOpen={() => setOpenId(seed.id)}
            />
          ))}
        </div>
      )}

      {open && (
        <ListingOverlay
          key={open.seed.id}
          listing={open.listing}
          seed={open.seed}
          entry={open.entry}
          isNew={isNew}
          isCustom={open.custom}
          findDuplicate={(address) => findDuplicate(address, open.seed.id)}
          onClose={closeOverlay}
          onSetStatus={(status) => updateEntry(open.seed.id, (e) => ({ ...e, status }))}
          onSetAppointment={(dateTime) => updateEntry(open.seed.id, (e) => ({ ...e, appointment: { dateTime } }))}
          onSetNotes={(notes) => updateEntry(open.seed.id, (e) => ({ ...e, notes }))}
          onSaveEdits={(edits) => {
            if (isNew) {
              updateEntry(open.seed.id, (e) => ({ ...e, custom: true, createdAt: Date.now(), edits }))
              setPendingNewId(null)
            } else {
              updateEntry(open.seed.id, (e) => ({ ...e, edits }))
            }
          }}
          onDelete={() => {
            deleteEntry(open.seed.id)
            closeOverlay()
          }}
        />
      )}

      {exportOpen && (
        <ExportOverlay records={exportRecords} changedCount={changedCount} onClose={() => setExportOpen(false)} />
      )}
    </div>
  )
}
