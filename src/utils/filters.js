import { PROPERTY_TYPE_LABELS } from '../constants.js'
import { petFit } from './format.js'

// Each filter: a dropdown of options; 'any' means "don't filter".
// test(listing, value) decides whether a listing passes.
export const FILTERS = [
  {
    key: 'pets',
    label: 'Pets',
    options: [
      ['any', 'Any'],
      ['fits', 'Cats & dogs OK'],
      ['possible', 'Not ruled out'],
      ['restricted', 'Has limits'],
      ['unknown', 'Needs checking'],
      ['no', 'Ruled out'],
    ],
    test: (l, v) => {
      const fit = petFit(l.pets)
      return v === 'possible' ? fit !== 'no' : fit === v
    },
  },
  {
    key: 'type',
    label: 'Type',
    options: [['any', 'Any'], ...Object.entries(PROPERTY_TYPE_LABELS)],
    test: (l, v) => l.propertyType === v,
  },
  {
    key: 'rent',
    label: 'Max rent',
    options: [
      ['any', 'Any'],
      ['2000', 'Up to $2,000'],
      ['2250', 'Up to $2,250'],
      ['2500', 'Up to $2,500'],
      ['2750', 'Up to $2,750'],
      ['3000', 'Up to $3,000'],
    ],
    // Uses the low end, so a complex whose range starts under budget passes.
    test: (l, v) => l.rent?.min != null && l.rent.min <= Number(v),
  },
  {
    key: 'beds',
    label: 'Beds',
    options: [
      ['any', 'Any'],
      ['2', '2+'],
      ['3', '3+'],
      ['4', '4+'],
    ],
    // Uses the high end, so a 1–3 bd complex counts as offering 3.
    test: (l, v) => {
      const best = l.beds?.max ?? l.beds?.min
      return best != null && best >= Number(v)
    },
  },
  {
    key: 'laundry',
    label: 'Laundry',
    options: [
      ['any', 'Any'],
      ['ok', 'In-unit or hookups'],
      ['in-unit', 'In-unit only'],
      ['unknown', 'Unknown'],
    ],
    test: (l, v) => {
      const laundry = l.amenities?.laundry || 'unknown'
      return v === 'ok' ? laundry === 'in-unit' || laundry === 'hookups' : laundry === v
    },
  },
  {
    key: 'contacted',
    label: 'Contacted',
    options: [
      ['any', 'Any'],
      ['yes', 'Yes'],
      ['no', 'Not yet'],
    ],
    test: (l, v) => Boolean(l.contacted) === (v === 'yes'),
  },
  ...['ac', 'dishwasher'].map((key) => ({
    key,
    label: key === 'ac' ? 'A/C' : 'Dishwasher',
    options: [
      ['any', 'Any'],
      ['yes', 'Yes'],
      ['not-no', 'Not ruled out'],
      ['unknown', 'Unknown'],
    ],
    test: (l, v) => {
      const value = l.amenities?.[key] || 'unknown'
      return v === 'not-no' ? value !== 'no' : value === v
    },
  })),
]

export const EMPTY_FILTERS = Object.fromEntries(FILTERS.map((f) => [f.key, 'any']))

export function activeFilterCount(filters) {
  return FILTERS.filter((f) => filters[f.key] && filters[f.key] !== 'any').length
}

export function applyFilters(items, filters) {
  const active = FILTERS.filter((f) => filters[f.key] && filters[f.key] !== 'any')
  if (active.length === 0) return items
  return items.filter(({ listing }) => active.every((f) => f.test(listing, filters[f.key])))
}
