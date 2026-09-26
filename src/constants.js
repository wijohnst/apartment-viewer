import schema from './data/listings.schema.json'

// Enum values come from the JSON Schema (single source of truth); this file
// only supplies display labels for them.
const enumOf = (name) => schema.$defs[name].enum

function withLabels(name, labels) {
  const values = enumOf(name)
  const missing = values.filter((v) => !(v in labels))
  if (missing.length) console.warn(`[constants] no label for ${name}: ${missing.join(', ')}`)
  return Object.fromEntries(values.map((v) => [v, labels[v] || v]))
}

export const CATEGORY_LABELS = withLabels('category', {
  'zillow-favorite': 'Zillow favorite',
  'whole-home': 'Whole-home rental',
  'off-market': 'Off-market',
  'apartment-complex': 'Apartment complex',
  'julias-list': "Julia's list",
  unverified: 'Unverified',
  disqualified: 'Disqualified',
  manual: 'Added manually',
})

export const STATUS_LABELS = withLabels('status', {
  new: 'Candidate',
  accepted: 'Accepted',
  rejected: 'Rejected',
})

export const PROPERTY_TYPE_LABELS = withLabels('propertyType', {
  house: 'House',
  townhome: 'Townhome',
  apartment: 'Apartment',
  'apartment-complex': 'Apartment complex',
})

export const PET_RULE_LABELS = withLabels('petRule', {
  allowed: 'Allowed',
  restricted: 'Restricted',
  'not-allowed': 'Not allowed',
  unknown: 'Unknown',
})

export const LAUNDRY_LABELS = withLabels('laundry', {
  'in-unit': 'In-unit W/D',
  hookups: 'W/D hookups',
  none: 'None',
  unknown: 'Unknown',
})

export const TRI_STATE_LABELS = withLabels('triState', {
  yes: 'Yes',
  no: 'No',
  unknown: 'Unknown',
})

export const AMENITY_LABELS = {
  laundry: 'Laundry',
  ac: 'A/C',
  dishwasher: 'Dishwasher',
  garage: 'Garage',
  outdoorSpace: 'Outdoor space',
}
