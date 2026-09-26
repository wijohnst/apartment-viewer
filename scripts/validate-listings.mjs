// npm run validate — check src/data/listings.json against listings.schema.json.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'))

const schema = read('src/data/listings.schema.json')
let listings
try {
  listings = read('src/data/listings.json')
} catch (err) {
  console.error(`✗ src/data/listings.json is not valid JSON: ${err.message}`)
  process.exit(1)
}

const validate = new Ajv2020({ allErrors: true }).compile(schema)
if (validate(listings)) {
  console.log(`✓ src/data/listings.json is valid (${listings.length} listings)`)
  process.exit(0)
}

if (Array.isArray(listings) && listings.some((l) => l && typeof l.pets !== 'object')) {
  console.error('✗ listings.json is still in the old free-text format.')
  console.error('  Open the app, click Export, and paste the result over src/data/listings.json.')
  process.exit(1)
}

console.error(`✗ ${validate.errors.length} problem(s) in src/data/listings.json:`)
for (const err of validate.errors.slice(0, 50)) {
  const [, index, ...field] = err.instancePath.split('/')
  const record = listings[Number(index)]
  const where = record ? `${record.id}${field.length ? '.' + field.join('.') : ''}` : err.instancePath || '(root)'
  const extra =
    err.keyword === 'enum'
      ? ` (${err.params.allowedValues.join(', ')})`
      : err.keyword === 'additionalProperties'
        ? ` "${err.params.additionalProperty}"`
        : ''
  console.error(`  ${where}: ${err.message}${extra}`)
}
process.exit(1)
