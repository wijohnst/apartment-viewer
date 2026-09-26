import fs from 'node:fs/promises'
import path from 'node:path'

const MAX_BODY_BYTES = 5 * 1024 * 1024

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('payload too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function validate(listings) {
  if (!Array.isArray(listings)) throw new Error('expected an array of listings')
  if (listings.length === 0) throw new Error('refusing to write an empty listings file')
  const ids = new Set()
  listings.forEach((l, i) => {
    if (!l || typeof l !== 'object') throw new Error(`entry ${i} is not an object`)
    if (typeof l.id !== 'string' || !l.id) throw new Error(`entry ${i} has no id`)
    if (ids.has(l.id)) throw new Error(`duplicate id: ${l.id}`)
    ids.add(l.id)
    if (typeof l.name !== 'string' || typeof l.address !== 'string') {
      throw new Error(`entry ${l.id} is missing name/address`)
    }
    if (!Array.isArray(l.images)) throw new Error(`entry ${l.id} has no images array`)
  })
}

function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

// Dev-server-only endpoint: PUT /__api/listings writes the posted array to
// src/data/listings.json, after copying the current file into backups/.
export default function listingsWriter() {
  return {
    name: 'listings-writer',
    apply: 'serve',
    configureServer(server) {
      const root = server.config.root
      const file = path.join(root, 'src/data/listings.json')
      const backupDir = path.join(root, 'backups')

      server.middlewares.use('/__api/listings', async (req, res) => {
        if (req.method !== 'PUT') return send(res, 405, { ok: false, error: 'use PUT' })
        try {
          const listings = JSON.parse(await readBody(req))
          validate(listings)

          await fs.mkdir(backupDir, { recursive: true })
          const stamp = new Date().toISOString().replace(/[:.]/g, '-')
          const backup = path.join(backupDir, `listings-${stamp}.json`)
          await fs.copyFile(file, backup)

          // Write to a temp file and rename, so a failure can't leave a
          // half-written listings.json.
          const tmp = path.join(backupDir, `.listings-${stamp}.tmp`)
          await fs.writeFile(tmp, JSON.stringify(listings, null, 2) + '\n')
          await fs.rename(tmp, file)

          server.config.logger.info(
            `[listings-writer] wrote ${listings.length} listings (backup: ${path.relative(root, backup)})`,
          )
          send(res, 200, { ok: true, count: listings.length, backup: path.relative(root, backup) })
        } catch (err) {
          send(res, 400, { ok: false, error: err.message })
        }
      })
    },
  }
}
