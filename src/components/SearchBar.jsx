import { useEffect, useRef } from 'react'

export default function SearchBar({ value, onChange }) {
  const inputRef = useRef(null)

  // "/" focuses search from anywhere (unless you're already typing somewhere).
  useEffect(() => {
    function onKey(e) {
      const tag = e.target.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable
      if (e.key === '/' && !typing) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="search">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onChange('')
            e.currentTarget.blur()
          }
        }}
        placeholder="Search address, name, pets, amenities, notes…  (press / to focus)"
        aria-label="Search listings"
        spellCheck={false}
        autoComplete="off"
      />
      {value && (
        <button type="button" className="search-clear" onClick={() => onChange('')} aria-label="Clear search">
          ✕
        </button>
      )}
    </div>
  )
}
