import { CATEGORY_LABELS, STATUS_LABELS, PROPERTY_TYPE_LABELS, PET_RULE_LABELS } from '../constants.js'
import { formatRent, formatLayout } from './format.js'

// Lowercase, strip accents, and drop commas/apostrophes so "$2,400" matches
// "2400" and "julias" matches "Julia's".
export function normalize(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[,'’]/g, '')
}

// Optimal string alignment distance (Levenshtein + adjacent transpositions),
// bailing out early once it exceeds `max`.
function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1
  const d = []
  for (let i = 0; i <= a.length; i++) {
    d[i] = [i]
  }
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, d[i - 2][j - 2] + 1)
      }
      d[i][j] = v
      if (v < rowMin) rowMin = v
    }
    if (rowMin > max) return max + 1
  }
  return d[a.length][b.length]
}

// Shortest window of `text` containing `token` as an in-order subsequence.
function subsequenceSpan(token, text) {
  let best = Infinity
  for (let start = text.indexOf(token[0]); start !== -1; start = text.indexOf(token[0], start + 1)) {
    let ti = 1
    let i = start + 1
    while (ti < token.length && i < text.length) {
      if (text[i] === token[ti]) ti++
      i++
    }
    if (ti < token.length) break // a later start can't do better
    best = Math.min(best, i - start)
  }
  return best
}

// Score one query token against one field. 0 = no match.
function tokenScore(token, field) {
  const { text, words } = field
  const idx = text.indexOf(token)
  if (idx !== -1) {
    const atWordStart = idx === 0 || /[^a-z0-9]/.test(text[idx - 1])
    return 100 + (atWordStart ? 20 : 0)
  }

  // Numbers (zips, rents, sqft) only match exactly — "97302" shouldn't
  // typo-match "97304".
  if (!/[a-z]/.test(token)) return 0

  let best = 0

  // Typos: "mangolia" -> "magnolia", "garge" -> "garage". Also compares
  // against word prefixes so half-typed words still match.
  if (token.length >= 4) {
    const maxDist = token.length >= 7 ? 2 : 1
    for (const word of words) {
      let dist = editDistance(token, word, maxDist)
      if (word.length > token.length) {
        dist = Math.min(dist, editDistance(token, word.slice(0, token.length), maxDist))
      }
      if (dist <= maxDist) best = Math.max(best, 70 - dist * 20)
    }
  }

  // Dropped letters: "mgnlia" -> "magnolia", "wsalem" -> "west salem".
  if (token.length >= 3) {
    const span = subsequenceSpan(token, text)
    const allowance = Math.max(2, Math.floor(token.length / 2))
    if (span <= token.length + allowance) best = Math.max(best, 50 - (span - token.length) * 4)
  }

  return best
}

function prepare(value, weight) {
  const text = normalize(value)
  return { text, words: text.split(/[^a-z0-9]+/).filter(Boolean), weight }
}

function searchableFields({ listing, entry }) {
  const contact = listing.contact || {}
  const pets = listing.pets || {}
  const a = listing.amenities || {}
  // Only positive amenities are searchable, so "garage" finds places that have one.
  const amenityWords = [
    a.laundry === 'in-unit' && 'in-unit laundry washer dryer',
    a.laundry === 'hookups' && 'washer dryer hookups',
    a.ac === 'yes' && 'a/c ac air conditioning',
    a.dishwasher === 'yes' && 'dishwasher',
    a.garage === 'yes' && 'garage',
    a.outdoorSpace === 'yes' && 'yard patio outdoor space',
  ]
    .filter(Boolean)
    .join(' ')
  return [
    [listing.name, 3],
    [listing.address, 2],
    [CATEGORY_LABELS[listing.category] || listing.category, 1],
    [STATUS_LABELS[entry.status] || entry.status, 1],
    [PROPERTY_TYPE_LABELS[listing.propertyType] || listing.propertyType, 1],
    [formatRent(listing.rent), 1],
    [listing.rent?.note, 1],
    [formatLayout(listing), 1],
    [listing.source, 1],
    [`cats ${PET_RULE_LABELS[pets.cats] || ''} dogs ${PET_RULE_LABELS[pets.dogs] || ''}`, 1],
    [pets.notes, 1],
    [amenityWords, 1],
    [listing.confirmedAmenities, 1],
    [listing.toVerify, 1],
    [listing.researchNotes, 1],
    [contact.company, 1],
    [contact.phone, 1],
    [contact.email, 1],
    [contact.notes, 1],
    [listing.contacted && 'contacted', 1],
    [entry.notes, 1],
  ]
    .filter(([value]) => value)
    .map(([value, weight]) => prepare(value, weight))
}

// items: [{ listing, entry }]. Every token in the query must match somewhere;
// results come back best-first. Empty query returns items unchanged.
export function searchListings(items, query) {
  const tokens = normalize(query).split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return items

  const scored = []
  items.forEach((item, index) => {
    const fields = searchableFields(item)
    let total = 0
    for (const token of tokens) {
      let best = 0
      for (const field of fields) {
        const s = tokenScore(token, field) * field.weight
        if (s > best) best = s
      }
      if (best === 0) return
      total += best
    }
    scored.push({ item, index, total })
  })

  scored.sort((a, b) => b.total - a.total || a.index - b.index)
  return scored.map((s) => s.item)
}
