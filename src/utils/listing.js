import { CATEGORY_LABELS } from '../constants.js'

// Every editable listing field, grouped the way the edit form lays them out.
// `key` may be a dotted path into nested objects (e.g. contact.phone).
export const FIELD_GROUPS = [
  {
    title: 'Listing',
    fields: [
      { key: 'name', label: 'Name', wide: true },
      { key: 'address', label: 'Address', wide: true, hint: 'Also drives the map' },
      { key: 'category', label: 'Category', type: 'select', options: Object.entries(CATEGORY_LABELS) },
      { key: 'propertyType', label: 'Property type' },
      { key: 'rent', label: 'Rent' },
      { key: 'bedsBaths', label: 'Beds / baths' },
      { key: 'score', label: 'Score (0–5)', type: 'number' },
    ],
  },
  {
    title: 'Source',
    fields: [
      { key: 'source', label: 'Source' },
      { key: 'sourceUrl', label: 'Listing URL', type: 'url', placeholder: 'https://…' },
      {
        key: 'images',
        label: 'Image URLs',
        type: 'lines',
        wide: true,
        hint: 'One URL per line. The first one is the preview image.',
      },
    ],
  },
  {
    title: 'Contact',
    fields: [
      { key: 'contact.company', label: 'Company / manager' },
      { key: 'contact.phone', label: 'Phone', type: 'tel' },
      { key: 'contact.email', label: 'Email', type: 'email', wide: true },
      { key: 'contact.notes', label: 'Contact notes', type: 'textarea', wide: true },
    ],
  },
  {
    title: 'Details',
    fields: [
      { key: 'petPolicy', label: 'Pet status', type: 'textarea', wide: true },
      { key: 'confirmedAmenities', label: 'Confirmed amenities', type: 'textarea', wide: true },
      { key: 'toVerify', label: 'To verify', type: 'textarea', wide: true },
      { key: 'researchNotes', label: 'Research notes', type: 'textarea', wide: true },
    ],
  },
]

export const ALL_FIELDS = FIELD_GROUPS.flatMap((group) => group.fields)

export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
}

function setPath(obj, path, value) {
  const keys = path.split('.')
  let target = obj
  keys.slice(0, -1).forEach((k) => {
    target[k] = target[k] || {}
    target = target[k]
  })
  target[keys[keys.length - 1]] = value
}

// Seed listing + locally saved edits = what the app displays.
export function applyEdits(seed, edits) {
  if (!edits || Object.keys(edits).length === 0) return seed
  return {
    ...seed,
    ...edits,
    contact: { ...(seed.contact || {}), ...(edits.contact || {}) },
  }
}

// Listing -> flat map of string values for form inputs.
export function toDraft(listing) {
  const draft = {}
  ALL_FIELDS.forEach((field) => {
    const value = getPath(listing, field.key)
    if (field.type === 'lines') draft[field.key] = (value || []).join('\n')
    else draft[field.key] = value == null ? '' : String(value)
  })
  return draft
}

function fromDraft(field, raw) {
  const text = raw == null ? '' : String(raw)
  if (field.type === 'lines') {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  }
  if (field.type === 'number') {
    if (text.trim() === '') return null
    const n = Number(text)
    return Number.isFinite(n) ? n : null
  }
  return text.trim()
}

function isBlank(v) {
  return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)
}

export function sameValue(a, b) {
  if (isBlank(a) && isBlank(b)) return true
  return JSON.stringify(a) === JSON.stringify(b)
}

// Drop edits that already match the seed (e.g. after listings.json was
// updated with an export), so they can't silently override later file edits.
export function pruneEdits(seed, edits) {
  const out = {}
  Object.entries(edits || {}).forEach(([key, value]) => {
    if (key === 'contact') {
      const contact = {}
      Object.entries(value || {}).forEach(([ck, cv]) => {
        if (!sameValue(cv, seed.contact?.[ck])) contact[ck] = cv
      })
      if (Object.keys(contact).length > 0) out.contact = contact
    } else if (!sameValue(value, seed[key])) {
      out[key] = value
    }
  })
  return out
}

// Only fields that differ from the seed are stored, so a seed refresh still
// flows through for anything we haven't touched.
export function diffEdits(seed, draft) {
  const edits = {}
  ALL_FIELDS.forEach((field) => {
    const value = fromDraft(field, draft[field.key])
    if (!sameValue(value, getPath(seed, field.key))) setPath(edits, field.key, value)
  })
  return edits
}

// Template for a listing added by hand in the app. Manual listings aren't in
// listings.json: they're rebuilt from this template + their saved edits.
export function blankListing(id) {
  return {
    id,
    name: '',
    address: '',
    category: 'manual',
    propertyType: '',
    rent: '',
    bedsBaths: '',
    source: '',
    sourceUrl: '',
    images: [],
    petPolicy: '',
    confirmedAmenities: '',
    toVerify: '',
    contact: { company: null, phone: null, email: null, notes: '' },
    score: null,
    researchNotes: '',
    seedStatus: 'new',
  }
}

export function newListingId() {
  return `manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

// Street portion of an address, reduced to letters/digits, for spotting
// duplicates ("3494 Maci Elle Ct SE, Salem" == "3494 maci elle ct se").
export function addressKey(address) {
  return String(address || '')
    .split(',')[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}
