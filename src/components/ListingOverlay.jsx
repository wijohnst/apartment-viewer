import { useEffect, useState } from 'react'
import { FIELD_GROUPS, toDraft, diffEdits } from '../utils/listing.js'

function mapEmbedUrl(address) {
  return `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`
}

function FormField({ field, value, onChange, autoFocus }) {
  const id = `field-${field.key.replace(/\./g, '-')}`
  const common = { id, value, autoFocus, onChange: (e) => onChange(e.target.value) }

  let control
  switch (field.type) {
    case 'textarea':
    case 'lines':
      control = <textarea {...common} rows={3} placeholder={field.placeholder} />
      break
    case 'select':
      control = (
        <select {...common}>
          {field.options.map(([optionValue, optionLabel]) => (
            <option key={optionValue} value={optionValue}>
              {optionLabel}
            </option>
          ))}
        </select>
      )
      break
    case 'number':
      control = <input {...common} type="number" min="0" max="5" step="0.5" />
      break
    default:
      control = <input {...common} type={field.type || 'text'} placeholder={field.placeholder} />
  }

  return (
    <div className={`form-field ${field.wide ? 'wide' : ''}`}>
      <label htmlFor={id}>{field.label}</label>
      {control}
      {field.hint && <small>{field.hint}</small>}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="detail-section">
      <h3>{title}</h3>
      {children}
    </div>
  )
}

function DetailView({ listing }) {
  const contact = listing.contact || {}
  const hasContact = contact.company || contact.phone || contact.email

  return (
    <>
      <Section title="Listing & source">
        <p>
          {listing.source || 'Unknown source'}
          {listing.sourceUrl ? (
            <>
              {' — '}
              <a href={listing.sourceUrl} target="_blank" rel="noreferrer">
                view listing
              </a>
            </>
          ) : (
            ' — no live listing page'
          )}
        </p>
      </Section>

      <Section title="Rent & layout">
        <p>{[listing.rent, listing.bedsBaths, listing.propertyType].filter(Boolean).join(' · ')}</p>
        {listing.score != null && <p className="subtle">Score: {listing.score}/5</p>}
      </Section>

      <Section title="Contact information">
        {hasContact ? (
          <p>
            {[
              contact.company && <span key="company">{contact.company}</span>,
              contact.phone && (
                <a key="phone" href={`tel:${contact.phone}`}>
                  {contact.phone}
                </a>
              ),
              contact.email && (
                <a key="email" href={`mailto:${contact.email}`}>
                  {contact.email}
                </a>
              ),
            ]
              .filter(Boolean)
              .reduce((acc, node, i) => (i === 0 ? [node] : [...acc, ' · ', node]), [])}
          </p>
        ) : (
          <p>Not on file</p>
        )}
        {contact.notes && <p className="subtle">{contact.notes}</p>}
      </Section>

      <Section title="Pet status">
        <p>{listing.petPolicy || 'Unknown'}</p>
      </Section>

      <Section title="Confirmed amenities">
        <p>{listing.confirmedAmenities || 'None confirmed yet'}</p>
      </Section>

      {listing.toVerify && (
        <Section title="To verify">
          <p>{listing.toVerify}</p>
        </Section>
      )}

      {listing.researchNotes && (
        <Section title="Research notes">
          <p>{listing.researchNotes}</p>
        </Section>
      )}
    </>
  )
}

export default function ListingOverlay({
  listing,
  seed,
  entry,
  isNew = false,
  isCustom = false,
  findDuplicate = () => null,
  onClose,
  onSetStatus,
  onSetAppointment,
  onSetNotes,
  onSaveEdits,
  onDelete,
}) {
  // New listings open straight into the form.
  const [draft, setDraft] = useState(() => (isNew ? toDraft(listing) : null))
  const [error, setError] = useState(null)
  const [imageIndex, setImageIndex] = useState(0)
  const editing = draft !== null
  const status = entry.status
  // Manual listings live entirely in edits, so "edited"/"revert" don't apply.
  const hasEdits = !isCustom && Object.keys(entry.edits || {}).length > 0
  const duplicate = editing && isNew ? findDuplicate(draft.address) : null
  const images = listing.images || []
  const currentImage = images[Math.min(imageIndex, images.length - 1)]

  // Escape closes the overlay, but never while there's an unsaved edit.
  useEffect(() => {
    if (editing) return undefined
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, onClose])

  function startEdit() {
    setDraft(toDraft(listing))
  }

  function cancelEdit() {
    setError(null)
    if (isNew) onClose()
    else setDraft(null)
  }

  function saveEdit() {
    const name = draft.name.trim()
    const address = draft.address.trim()
    if (!name && !address) {
      setError('Add at least a name or an address.')
      return
    }
    // Fall back to the street address as the name.
    const finalDraft = name ? draft : { ...draft, name: address.split(',')[0].trim() }
    onSaveEdits(diffEdits(seed, finalDraft))
    setError(null)
    setDraft(null)
    setImageIndex(0)
  }

  function deleteListing() {
    if (window.confirm(`Delete "${listing.name}"? This removes it and its notes from the app.`)) onDelete()
  }

  function revertEdits() {
    if (window.confirm('Discard all edits to this listing and restore the original data?')) {
      onSaveEdits({})
      setImageIndex(0)
    }
  }

  return (
    <div className="overlay-backdrop" onClick={editing ? undefined : onClose}>
      <div className="overlay-panel" onClick={(e) => e.stopPropagation()}>
        <div className="overlay-header">
          <div className="overlay-title">
            <h2>{editing ? (isNew ? 'New listing' : 'Editing listing') : listing.name}</h2>
            {!editing && <div className="address">{listing.address}</div>}
            {!editing && hasEdits && <span className="badge edited">Edited locally</span>}
          </div>
          <div className="header-actions">
            {editing ? (
              <>
                <button type="button" className="btn secondary" onClick={cancelEdit}>
                  Cancel
                </button>
                <button type="button" className="btn primary" onClick={saveEdit}>
                  {isNew ? 'Add' : 'Save'}
                </button>
              </>
            ) : (
              <>
                {isCustom && (
                  <button type="button" className="btn reset danger" onClick={deleteListing}>
                    Delete listing
                  </button>
                )}
                {hasEdits && (
                  <button type="button" className="btn reset" onClick={revertEdits}>
                    Revert to original
                  </button>
                )}
                <button type="button" className="btn secondary" onClick={startEdit}>
                  Edit details
                </button>
                <button type="button" className="close-button" onClick={onClose} aria-label="Close">
                  ✕
                </button>
              </>
            )}
          </div>
        </div>

        {!isNew && (
          <div className="overlay-image">
            {currentImage ? <img src={currentImage} alt={listing.name} /> : <span>No preview image yet</span>}
          </div>
        )}
        {!editing && images.length > 1 && (
          <div className="thumbs">
            {images.map((src, i) => (
              <button
                type="button"
                key={src + i}
                className={i === imageIndex ? 'active' : ''}
                onClick={() => setImageIndex(i)}
                aria-label={`Show image ${i + 1}`}
              >
                <img src={src} alt="" />
              </button>
            ))}
          </div>
        )}

        <div className="overlay-body">
          <div>
            {editing ? (
              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault()
                  saveEdit()
                }}
              >
                {error && <p className="form-error">{error}</p>}
                {duplicate && (
                  <p className="form-warning">Heads up: “{duplicate.name}” is already in the list at this address.</p>
                )}
                {FIELD_GROUPS.map((group) => (
                  <div className="form-group" key={group.title}>
                    <h3>{group.title}</h3>
                    <div className="form-grid">
                      {group.fields.map((field) => (
                        <FormField
                          key={field.key}
                          field={field}
                          value={draft[field.key]}
                          autoFocus={isNew && field.key === 'name'}
                          onChange={(value) => setDraft((d) => ({ ...d, [field.key]: value }))}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                <div className="action-row">
                  <button type="submit" className="btn primary">
                    {isNew ? 'Add listing' : 'Save changes'}
                  </button>
                  <button type="button" className="btn secondary" onClick={cancelEdit}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <DetailView listing={listing} />
            )}
          </div>

          {isNew ? (
            <div>
              <Section title="Decision & notes">
                <p className="subtle">
                  Save the listing first, then you can accept or reject it, book an appointment, and add notes.
                </p>
              </Section>
            </div>
          ) : (
            <div>
              <Section title="Map">
                {listing.address ? (
                  <iframe
                    className="map-frame"
                    title={`Map of ${listing.name}`}
                    src={mapEmbedUrl(listing.address)}
                    loading="lazy"
                  />
                ) : (
                  <p>No address on file</p>
                )}
              </Section>

              <Section title="Decision">
                <div className="action-row">
                  <button
                    type="button"
                    className={`btn accept ${status === 'accepted' ? 'active' : ''}`}
                    onClick={() => onSetStatus(status === 'accepted' ? 'new' : 'accepted')}
                  >
                    {status === 'accepted' ? 'Accepted ✓' : 'Accept'}
                  </button>
                  <button
                    type="button"
                    className={`btn reject ${status === 'rejected' ? 'active' : ''}`}
                    onClick={() => onSetStatus(status === 'rejected' ? 'new' : 'rejected')}
                  >
                    {status === 'rejected' ? 'Rejected ✓' : 'Reject'}
                  </button>
                </div>
              </Section>

              {status === 'accepted' && (
                <Section title="Appointment">
                  <input
                    type="datetime-local"
                    value={entry.appointment?.dateTime || ''}
                    onChange={(e) => onSetAppointment(e.target.value)}
                  />
                </Section>
              )}

              <Section title="Notes">
                <textarea
                  value={entry.notes || ''}
                  onChange={(e) => onSetNotes(e.target.value)}
                  placeholder="Notes from a call, a tour, or anything worth remembering about this one..."
                />
              </Section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
