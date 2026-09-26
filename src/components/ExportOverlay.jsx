import { useEffect, useMemo, useRef, useState } from 'react'
import { copyText } from '../utils/clipboard.js'
import { validate } from '../utils/validate.js'

// Strings (keys vs values), numbers, and true/false/null. Strings are matched
// first, so digits inside a string stay part of the string.
const TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g

function highlight(json) {
  const out = []
  let last = 0
  for (const m of json.matchAll(TOKEN)) {
    if (m.index > last) out.push(json.slice(last, m.index))
    if (m[1]) {
      out.push(
        <span key={m.index} className={m[2] ? 'json-key' : 'json-string'}>
          {m[1]}
        </span>,
      )
      if (m[2]) out.push(m[2])
    } else if (m[3]) {
      out.push(
        <span key={m.index} className="json-literal">
          {m[3]}
        </span>,
      )
    } else {
      out.push(
        <span key={m.index} className="json-number">
          {m[0]}
        </span>,
      )
    }
    last = m.index + m[0].length
  }
  out.push(json.slice(last))
  return out
}

export default function ExportOverlay({ records, changedCount, fileNeedsUpgrade, onClose }) {
  const json = useMemo(() => JSON.stringify(records, null, 2) + '\n', [records])
  const validation = useMemo(() => validate(records), [records])
  const [showErrors, setShowErrors] = useState(false)
  const highlighted = useMemo(() => highlight(json), [json])
  const [copyState, setCopyState] = useState('idle') // idle | copied | failed
  const preRef = useRef(null)

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (copyState !== 'copied') return undefined
    const t = setTimeout(() => setCopyState('idle'), 2000)
    return () => clearTimeout(t)
  }, [copyState])

  async function handleCopy() {
    try {
      await copyText(json)
      setCopyState('copied')
    } catch (err) {
      console.error('Copy failed', err)
      setCopyState('failed')
      // Select the text so it can be copied by hand.
      if (preRef.current) window.getSelection()?.selectAllChildren(preRef.current)
    }
  }

  const sizeKb = (new Blob([json]).size / 1024).toFixed(1)

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay-panel export-panel" onClick={(e) => e.stopPropagation()}>
        <div className="overlay-header">
          <div className="overlay-title">
            <h2>Export listings.json</h2>
            <div className="address">
              {records.length} listings · {sizeKb} KB ·{' '}
              {fileNeedsUpgrade
                ? 'upgrades listings.json to the new format'
                : changedCount > 0
                  ? `includes ${changedCount} with local changes`
                  : 'no local changes — matches the current file'}
            </div>
          </div>
          <div className="header-actions">
            <button type="button" className="btn primary" onClick={handleCopy}>
              {copyState === 'copied' ? 'Copied ✓' : 'Copy'}
            </button>
            <button type="button" className="close-button" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        </div>

        <div className="export-body">
          {copyState === 'failed' && (
            <p className="form-error">
              Couldn't copy automatically. The text is selected — copy it with ⌘C (or long-press → Copy on mobile).
            </p>
          )}
          {validation.valid ? (
            <p className="schema-status valid">✓ Valid against listings.schema.json</p>
          ) : (
            <div className="schema-status invalid">
              <button type="button" className="past-toggle" onClick={() => setShowErrors((v) => !v)}>
                {showErrors ? '▾' : '▸'} ✗ {validation.errors.length} schema{' '}
                {validation.errors.length === 1 ? 'problem' : 'problems'} — fix before replacing the file
              </button>
              {showErrors && (
                <ul>
                  {validation.errors.slice(0, 50).map((err, i) => (
                    <li key={i}>
                      <strong>{err.where}</strong>: {err.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <p className="subtle export-hint">
            Replace the contents of <code>src/data/listings.json</code> with this. It includes your edits, added
            listings, statuses, notes, and appointments. Once the updated file is loaded, local changes that match it
            are cleared automatically.
          </p>
          <pre ref={preRef} className="json-view">
            <code>{highlighted}</code>
          </pre>
        </div>
      </div>
    </div>
  )
}
