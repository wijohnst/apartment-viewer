import {
  CATEGORY_LABELS,
  PROPERTY_TYPE_LABELS,
  PET_RULE_LABELS,
  LAUNDRY_LABELS,
  TRI_STATE_LABELS,
} from '../constants.js'

const options = (labels) => Object.entries(labels)

// Every editable listing field, grouped the way the edit form lays them out.
// `key` may be a dotted path into nested objects (e.g. contact.phone).
// Types: text (default) | textarea | lines | select | number | url | tel |
// email | boolean | range ("3", "1-3", "2+") | money-range ("2400", "1,335-1,995", "2614+").
export const FIELD_GROUPS = [
  {
    title: 'Listing',
    fields: [
      { key: 'name', label: 'Name', wide: true },
      { key: 'address', label: 'Address', wide: true, hint: 'Also drives the map' },
      { key: 'category', label: 'Category', type: 'select', options: options(CATEGORY_LABELS) },
      { key: 'propertyType', label: 'Property type', type: 'select', options: options(PROPERTY_TYPE_LABELS) },
      { key: 'score', label: 'Score (0–5)', type: 'number', min: 0, max: 5, step: 0.5 },
    ],
  },
  {
    title: 'Rent & layout',
    fields: [
      {
        key: 'rent',
        label: 'Rent ($/mo)',
        type: 'money-range',
        placeholder: '2400 · 1335–1995 · 2614+',
      },
      { key: 'rent.note', label: 'Rent note', placeholder: 'e.g. total, incl. move-in special' },
      { key: 'beds', label: 'Beds', type: 'range', placeholder: '3 · 2–3' },
      { key: 'baths', label: 'Baths', type: 'range', placeholder: '2 · 2.5 · 1–2' },
      { key: 'sqft', label: 'Sq ft', type: 'number', min: 0, step: 1, integer: true },
    ],
  },
  {
    title: 'Pets',
    fields: [
      { key: 'pets.cats', label: 'Cats', type: 'select', options: options(PET_RULE_LABELS) },
      { key: 'pets.dogs', label: 'Dogs', type: 'select', options: options(PET_RULE_LABELS) },
      { key: 'pets.notes', label: 'Pet notes', type: 'textarea', wide: true, placeholder: 'Limits, fees, deposits…' },
    ],
  },
  {
    title: 'Amenities',
    fields: [
      { key: 'amenities.laundry', label: 'Laundry', type: 'select', options: options(LAUNDRY_LABELS) },
      { key: 'amenities.ac', label: 'A/C', type: 'select', options: options(TRI_STATE_LABELS) },
      { key: 'amenities.dishwasher', label: 'Dishwasher', type: 'select', options: options(TRI_STATE_LABELS) },
      { key: 'amenities.garage', label: 'Garage', type: 'select', options: options(TRI_STATE_LABELS) },
      { key: 'amenities.outdoorSpace', label: 'Outdoor space', type: 'select', options: options(TRI_STATE_LABELS) },
      { key: 'confirmedAmenities', label: 'Amenity notes', type: 'textarea', wide: true },
      { key: 'toVerify', label: 'To verify', type: 'textarea', wide: true },
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
      { key: 'contacted', label: 'Contacted', type: 'boolean', wide: true, hint: "Has the lister been contacted?" },
      { key: 'contact.company', label: 'Company / manager' },
      { key: 'contact.phone', label: 'Phone', type: 'tel' },
      { key: 'contact.email', label: 'Email', type: 'email', wide: true },
      { key: 'contact.notes', label: 'Contact notes', type: 'textarea', wide: true },
    ],
  },
  {
    title: 'Research',
    fields: [{ key: 'researchNotes', label: 'Research notes', type: 'textarea', wide: true }],
  },
]

export const ALL_FIELDS = FIELD_GROUPS.flatMap((group) => group.fields)

// Object-valued fields whose edits merge key-by-key into the seed.
const NESTED_KEYS = ['contact', 'rent', 'beds', 'baths', 'pets', 'amenities']

export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function setPath(obj, path, value) {
  const keys = path.split('.')
  let target = obj
  keys.slice(0, -1).forEach((k) => {
    target[k] = target[k] || {}
    target = target[k]
  })
  const last = keys[keys.length - 1]
  target[last] = isPlainObject(value) && isPlainObject(target[last]) ? { ...target[last], ...value } : value
}

// Seed listing + locally saved edits = what the app displays.
export function applyEdits(seed, edits) {
  if (!edits || Object.keys(edits).length === 0) return seed
  const merged = { ...seed, ...edits }
  NESTED_KEYS.forEach((k) => {
    if (isPlainObject(edits[k])) merged[k] = { ...(seed[k] || {}), ...edits[k] }
  })
  return merged
}

// ---- range inputs ----------------------------------------------------------

const num = (n) => String(n)

function rangeToInput(range) {
  const min = range?.min ?? null
  const max = range?.max ?? null
  if (min == null && max == null) return ''
  if (min != null && max == null) return `${num(min)}+`
  if (min == null) return `0–${num(max)}`
  return min === max ? num(min) : `${num(min)}–${num(max)}`
}

// "3" | "1-3" | "1–3" | "2+" | "$1,335 – $1,995" -> { min, max } ; null if unparseable
export function parseRangeInput(text, { integer = false } = {}) {
  const cleaned = String(text ?? '')
    .replace(/[$,\s]/g, '')
    .replace(/[–—]/g, '-')
  if (cleaned === '') return { min: null, max: null }
  const m = cleaned.match(/^(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?(\+)?$/)
  if (!m || (m[2] && m[3])) return null
  const min = Number(m[1])
  const max = m[3] ? null : m[2] ? Number(m[2]) : min
  if (max != null && max < min) return null
  if (integer && (!Number.isInteger(min) || (max != null && !Number.isInteger(max)))) return null
  return { min, max }
}

// ---- draft <-> values --------------------------------------------------------

function comparable(field, value) {
  // A range field only owns min/max; siblings like rent.note are separate fields.
  if (field.type === 'range' || field.type === 'money-range') {
    return { min: value?.min ?? null, max: value?.max ?? null }
  }
  return value
}

// Listing -> flat map of string values for form inputs.
export function toDraft(listing) {
  const draft = {}
  ALL_FIELDS.forEach((field) => {
    const value = getPath(listing, field.key)
    if (field.type === 'lines') draft[field.key] = (value || []).join('\n')
    else if (field.type === 'range' || field.type === 'money-range') draft[field.key] = rangeToInput(value)
    else if (field.type === 'boolean') draft[field.key] = value ? 'true' : 'false'
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
  if (field.type === 'range') return parseRangeInput(text)
  if (field.type === 'money-range') return parseRangeInput(text, { integer: true })
  if (field.type === 'number') {
    if (text.trim() === '') return null
    const n = Number(text)
    return Number.isFinite(n) ? n : null
  }
  if (field.type === 'select') return text
  if (field.type === 'boolean') return text === 'true'
  return text.trim()
}

// Field-level problems that would make the data invalid against the schema.
export function validateDraft(draft) {
  const errors = {}
  ALL_FIELDS.forEach((field) => {
    const raw = draft[field.key]
    const text = raw == null ? '' : String(raw).trim()
    if (field.type === 'range' && fromDraft(field, raw) === null) {
      errors[field.key] = 'Use a number, a range like 1–3, or 2+'
    }
    if (field.type === 'money-range' && fromDraft(field, raw) === null) {
      errors[field.key] = 'Use whole dollars: 2400, 1335–1995, or 2614+'
    }
    if (field.type === 'number' && text !== '') {
      const n = Number(text)
      if (!Number.isFinite(n)) errors[field.key] = 'Must be a number'
      else if (field.integer && !Number.isInteger(n)) errors[field.key] = 'Must be a whole number'
      else if ((field.min != null && n < field.min) || (field.max != null && n > field.max)) {
        errors[field.key] = `Must be between ${field.min ?? '…'} and ${field.max ?? '…'}`
      }
    }
    if (field.type === 'url' && text && !/^https?:\/\/.+/.test(text)) errors[field.key] = 'Must start with http:// or https://'
    if (field.type === 'lines') {
      const bad = fromDraft(field, raw).filter((line) => !/^https?:\/\/.+/.test(line))
      if (bad.length) errors[field.key] = `Not a URL: ${bad[0]}`
    }
  })
  return errors
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
    if (NESTED_KEYS.includes(key) && isPlainObject(value)) {
      const nested = {}
      Object.entries(value).forEach(([nk, nv]) => {
        if (!sameValue(nv, seed[key]?.[nk])) nested[nk] = nv
      })
      if (Object.keys(nested).length > 0) out[key] = nested
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
    if (!sameValue(comparable(field, value), comparable(field, getPath(seed, field.key)))) {
      setPath(edits, field.key, value)
    }
  })
  return edits
}

// Template for a listing added by hand in the app. Manual listings aren't in
// listings.json until exported: they're rebuilt from this template + edits.
export function blankListing(id) {
  return {
    id,
    name: '',
    address: '',
    category: 'manual',
    propertyType: 'house',
    rent: { min: null, max: null, note: '' },
    beds: { min: null, max: null },
    baths: { min: null, max: null },
    sqft: null,
    source: '',
    sourceUrl: '',
    images: [],
    pets: { cats: 'unknown', dogs: 'unknown', notes: '' },
    amenities: { laundry: 'unknown', ac: 'unknown', dishwasher: 'unknown', garage: 'unknown', outdoorSpace: 'unknown' },
    confirmedAmenities: '',
    toVerify: '',
    contact: { company: null, phone: null, email: null, notes: '' },
    contacted: false,
    score: null,
    researchNotes: '',
    seedStatus: 'new',
    notes: '',
    appointment: { dateTime: null },
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
