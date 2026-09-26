const money = (n) => `$${Number(n).toLocaleString('en-US')}`

export function formatRange(range, suffix = '') {
  const min = range?.min ?? null
  const max = range?.max ?? null
  if (min == null && max == null) return ''
  if (min != null && max != null) return min === max ? `${min}${suffix}` : `${min}–${max}${suffix}`
  if (min != null) return `${min}+${suffix}`
  return `up to ${max}${suffix}`
}

export function formatRent(rent) {
  const min = rent?.min ?? null
  const max = rent?.max ?? null
  if (min == null && max == null) return ''
  if (min != null && max != null) return min === max ? money(min) : `${money(min)}–${money(max)}`
  if (min != null) return `${money(min)}+`
  return `up to ${money(max)}`
}

// "3 bd · 2.5 ba · 1,648 sqft"
export function formatLayout(listing) {
  const parts = []
  const beds = formatRange(listing.beds)
  const baths = formatRange(listing.baths)
  if (beds) parts.push(`${beds} bd`)
  if (baths) parts.push(`${baths} ba`)
  if (listing.sqft) parts.push(`${Number(listing.sqft).toLocaleString('en-US')} sqft`)
  return parts.join(' · ')
}

// How well a listing's pet rules fit a household with cats and a dog.
//   fits       — cats and dogs both allowed
//   restricted — nothing ruled out or unknown, but there are limits to check
//   unknown    — at least one of cats/dogs not confirmed yet
//   no         — cats or dogs not allowed
export function petFit(pets) {
  const rules = [pets?.cats || 'unknown', pets?.dogs || 'unknown']
  if (rules.includes('not-allowed')) return 'no'
  if (rules.includes('unknown')) return 'unknown'
  if (rules.includes('restricted')) return 'restricted'
  return 'fits'
}

export const PET_FIT_LABELS = {
  fits: 'Pets OK',
  restricted: 'Pet limits',
  unknown: 'Pets ?',
  no: 'Pets ✗',
}
