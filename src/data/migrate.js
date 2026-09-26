// v1 -> v2 listing migration.
//
// v1 kept rent, layout, pets, and property type as free text. v2 structures
// them (see listings.schema.json). The app runs every seed record through
// migrateListing() on load, so an old listings.json keeps working; exporting
// from the app then produces a v2 file. Once listings.json is v2 this module
// is a no-op for seeds and only matters for old localStorage edits.

const DEFAULT_PETS = { cats: 'unknown', dogs: 'unknown', notes: '' }
const DEFAULT_AMENITIES = {
  laundry: 'unknown',
  ac: 'unknown',
  dishwasher: 'unknown',
  garage: 'unknown',
  outdoorSpace: 'unknown',
}

// Hand-reviewed from each v1 record's petPolicy / confirmedAmenities /
// toVerify / researchNotes text (2026-09-26). Free text is kept alongside as
// pets.notes and confirmedAmenities, so nothing is lost.
const REVIEWED = {
  'manual-muirs0fh-ibna': { pets: ['allowed', 'allowed'] }, // "Pets okay"
  'manual-muirbnmn-dasc': { pets: ['allowed', 'allowed'] }, // "Cats and dog okay"
  'manual-muiqvdds-pzkw': { pets: ['allowed', 'restricted'], amenities: { garage: 'yes', outdoorSpace: 'yes' } }, // "Cats, small dogs okay"; good backyard, detached garage
  'manual-muiqqxi4-e48u': { pets: ['unknown', 'restricted'] }, // "small dogs okay, cats unconfirmed"
  'alta-view-dr-s-1715': {},
  'ammon-st-nw-1494': { pets: ['allowed', 'allowed'] }, // "Accepted"; pet policy dropped from to-verify
  'myers-st-s-295': { pets: ['allowed', 'unknown'] }, // "Cats okay", to-verify "Dog?"
  'magnolia36-maci-elle-ct-se-3494': {
    pets: ['allowed', 'allowed'],
    amenities: { laundry: 'in-unit', ac: 'yes', dishwasher: 'yes', garage: 'yes' },
  },
  'fairway-waln-dr-se-1691-unit221': {
    pets: ['allowed', 'allowed'],
    amenities: { laundry: 'in-unit', ac: 'yes', dishwasher: 'yes' },
  },
  'the-grove-apartments-outward-rd-se-3955': {
    pets: ['restricted', 'restricted'], // limit 2 per unit
    amenities: { laundry: 'in-unit' },
  },
  'titan-hill-townhomes-linwood-st-nw-1809': { propertyType: 'townhome' },
  'sunnyview-townhomes-sunnyview-rd-ne-3930': { propertyType: 'townhome' },
  'heather-ln-se-1198': {
    pets: ['allowed', 'allowed'],
    amenities: { laundry: 'hookups', garage: 'yes', outdoorSpace: 'yes' },
  },
  'madrona-ave-se-1420': { amenities: { laundry: 'hookups', garage: 'yes', outdoorSpace: 'yes' } },
  'wagtail-ct-1965': {
    pets: ['unknown', 'restricted'], // 1 small mature dog; cats not mentioned
    amenities: { ac: 'yes', dishwasher: 'yes', garage: 'yes' },
  },
  'gateway-village-madras-st-se-1900': { pets: ['allowed', 'allowed'], amenities: { laundry: 'in-unit' } },
  'encore-reed-ln-se-5861': { pets: ['allowed', 'allowed'], amenities: { laundry: 'in-unit', ac: 'yes' } },
  'julias-list-the-fairway': {
    pets: ['allowed', 'allowed'],
    amenities: { laundry: 'in-unit', ac: 'yes', dishwasher: 'yes' },
  },
  'julias-list-the-grove': { pets: ['restricted', 'restricted'], amenities: { laundry: 'in-unit' } },
  'julias-list-magnolia98': {
    pets: ['allowed', 'allowed'],
    amenities: { laundry: 'in-unit', dishwasher: 'yes' },
  },
  'julias-list-magnolia36': {
    pets: ['allowed', 'allowed'],
    amenities: { laundry: 'in-unit', ac: 'yes', dishwasher: 'yes', garage: 'yes' },
  },
  'kari-dawn-ave-se-1959': { propertyType: 'townhome' },
  'reserve-at-hawks-ridge-whitaker-dr-se-1569': {
    pets: ['not-allowed', 'restricted'], // no cats; 1 dog under 25 lbs
    amenities: { laundry: 'in-unit', ac: 'yes', dishwasher: 'yes', outdoorSpace: 'yes' },
  },
}

const PROPERTY_TYPES = {
  house: 'house',
  home: 'house',
  'single family': 'house',
  townhome: 'townhome',
  townhouse: 'townhome',
  apartment: 'apartment',
  condo: 'apartment',
  'apartment complex': 'apartment-complex',
  'apartment-complex': 'apartment-complex',
  complex: 'apartment-complex',
}

export function mapPropertyType(text) {
  const key = String(text || '')
    .trim()
    .toLowerCase()
  return PROPERTY_TYPES[key] || 'house'
}

// Dollar amounts >= $800 (so "$500 move-in special" or "3bd" aren't read
// as rent). A single amount followed by "+" means "and up".
export function parseRent(text) {
  const raw = String(text ?? '').trim()
  const values = [...raw.matchAll(/\$?\s?(\d{1,3}(?:,\d{3})+|\d{3,5})(?!\d)/g)]
    .map((m) => Number(m[1].replace(/,/g, '')))
    .filter((n) => n >= 800)
  // Keep the original only when it has words the numbers don't capture.
  const note = /[a-z]/i.test(raw) ? raw : ''
  if (values.length === 0) return { min: null, max: null, note }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const openEnded = values.length === 1 && /\+/.test(raw)
  return { min, max: openEnded ? null : max, note }
}

function range(a, b) {
  const min = a == null ? null : Number(a)
  const max = b == null ? min : Number(b)
  return { min, max }
}

// "3bd/2ba, 1,648 sqft" | "3/2.5" | "1-3bd, 1-2ba" | "2bd + bonus room"
export function parseLayout(text) {
  const raw = String(text ?? '').trim()
  const out = { beds: { min: null, max: null }, baths: { min: null, max: null }, sqft: null, leftover: '' }
  if (!raw) return out
  const slash = raw.match(/^(\d+)\s*\/\s*(\d+(?:\.\d+)?)$/)
  if (slash) {
    out.beds = range(slash[1])
    out.baths = range(slash[2])
    return out
  }
  let rest = raw
  const beds = raw.match(/(\d+)\s*(?:[-–]\s*(\d+))?\s*bd\b/i)
  if (beds) {
    out.beds = range(beds[1], beds[2])
    rest = rest.replace(beds[0], '')
  }
  const baths = raw.match(/(\d+(?:\.\d+)?)\s*(?:[-–]\s*(\d+(?:\.\d+)?))?\s*ba\b/i)
  if (baths) {
    out.baths = range(baths[1], baths[2])
    rest = rest.replace(baths[0], '')
  }
  const sqft = raw.match(/([\d,]+)\s*sq\.?\s*ft/i)
  if (sqft) {
    out.sqft = Number(sqft[1].replace(/,/g, ''))
    rest = rest.replace(sqft[0], '')
  }
  // Anything meaningful we couldn't structure, e.g. "+ bonus room".
  if (/[a-z]{3,}/i.test(rest)) out.leftover = raw
  return out
}

export function isLegacyListing(record) {
  return !record || typeof record.pets !== 'object' || record.pets === null
}

// v1 record -> v2 record. v2 records pass through with defaults filled in.
export function migrateListing(record) {
  if (!isLegacyListing(record)) return normalizeListing(record)
  const {
    petPolicy,
    bedsBaths,
    rent,
    propertyType,
    researchNotes = '',
    ...rest
  } = record
  const reviewed = REVIEWED[record.id] || {}
  const layout = parseLayout(bedsBaths)
  const [cats, dogs] = reviewed.pets || ['unknown', 'unknown']
  const notesExtra = layout.leftover ? `Layout (original): ${layout.leftover}` : ''
  return normalizeListing({
    ...rest,
    propertyType: reviewed.propertyType || mapPropertyType(propertyType),
    rent: typeof rent === 'object' && rent ? rent : parseRent(rent),
    beds: layout.beds,
    baths: layout.baths,
    sqft: layout.sqft,
    pets: { cats, dogs, notes: String(petPolicy || '').trim() },
    amenities: { ...DEFAULT_AMENITIES, ...(reviewed.amenities || {}) },
    researchNotes: [researchNotes, notesExtra].filter(Boolean).join('\n'),
  })
}

// Fill in any missing v2 fields with defaults.
export function normalizeListing(r) {
  return {
    ...r,
    rent: { min: null, max: null, note: '', ...(r.rent || {}) },
    beds: { min: null, max: null, ...(r.beds || {}) },
    baths: { min: null, max: null, ...(r.baths || {}) },
    sqft: r.sqft ?? null,
    pets: { ...DEFAULT_PETS, ...(r.pets || {}) },
    amenities: { ...DEFAULT_AMENITIES, ...(r.amenities || {}) },
    images: r.images || [],
    confirmedAmenities: r.confirmedAmenities || '',
    toVerify: r.toVerify || '',
    researchNotes: r.researchNotes || '',
    contact: { company: null, phone: null, email: null, notes: '', ...(r.contact || {}) },
    score: r.score ?? null,
    seedStatus: r.seedStatus || 'new',
    notes: r.notes || '',
    appointment: { dateTime: r.appointment?.dateTime ?? null },
  }
}

// Old localStorage edits used v1 keys. Convert them to v2 edit paths.
export function migrateEdits(edits) {
  if (!edits) return {}
  const { petPolicy, rent, bedsBaths, propertyType, ...rest } = edits
  const out = { ...rest }
  if (petPolicy !== undefined) out.pets = { ...(out.pets || {}), notes: String(petPolicy || '') }
  if (typeof rent === 'string') out.rent = parseRent(rent)
  else if (rent !== undefined) out.rent = rent
  if (bedsBaths !== undefined) {
    const layout = parseLayout(bedsBaths)
    out.beds = layout.beds
    out.baths = layout.baths
    out.sqft = layout.sqft
  }
  if (propertyType !== undefined) {
    out.propertyType = PROPERTY_TYPES[String(propertyType).trim().toLowerCase()] ? mapPropertyType(propertyType) : propertyType
  }
  return out
}
