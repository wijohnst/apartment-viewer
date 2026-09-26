// Writes the dataset back to src/data/listings.json through the dev-server
// endpoint in vite-plugins/listings-writer.js. Only works under `npm run dev`.
export async function writeListingsFile(records) {
  let res
  try {
    res = await fetch('/__api/listings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(records),
    })
  } catch (err) {
    throw new Error(`couldn't reach the dev server (${err.message})`)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `the dev server answered ${res.status} — is this running under npm run dev?`)
  }
  return data
}

// Fallback: hand the same JSON to the browser as a download.
export function downloadJson(records, filename = 'listings.json') {
  const blob = new Blob([JSON.stringify(records, null, 2) + '\n'], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
