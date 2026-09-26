import Ajv2020 from 'ajv/dist/2020'
import schema from '../data/listings.schema.json'

const ajv = new Ajv2020({ allErrors: true })
const validateListings = ajv.compile(schema)

// Validate a listings array against listings.schema.json.
// Returns { valid, errors: [{ where, message }] } with readable locations.
export function validate(listings) {
  const valid = validateListings(listings)
  if (valid) return { valid: true, errors: [] }
  const errors = (validateListings.errors || []).map((err) => {
    const [, index, ...path] = err.instancePath.split('/')
    const record = listings[Number(index)]
    const field = path.join('.')
    const where = record ? `${record.name || record.id}${field ? ` → ${field}` : ''}` : err.instancePath || '(root)'
    let message = err.message
    if (err.keyword === 'enum') message += `: ${err.params.allowedValues.join(', ')}`
    if (err.keyword === 'additionalProperties') message = `unexpected field "${err.params.additionalProperty}"`
    return { where, message }
  })
  return { valid: false, errors }
}
