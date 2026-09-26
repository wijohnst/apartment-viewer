import { useEffect, useState } from 'react'
import { FIELD_GROUPS, toDraft, diffEdits, validateDraft } from '../utils/listing.js'
import {
  PROPERTY_TYPE_LABELS,
  PET_RULE_LABELS,
  LAUNDRY_LABELS,
  TRI_STATE_LABELS,
  AMENITY_LABELS,
} from '../constants.js'
import { formatRent, formatLayout, petFit, PET_FIT_LABELS } from '../utils/format.js'

function mapEmbedUrl(address) {
  return `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`
}

function FormField({ field, value, onChange, autoFocus, error }) {
  const id = `field-${field.key.replace(/\./g, '-')}`
  const common = {
    id,
    autoFocus,
    'aria-invalid': error ? 'true' : undefined,
  }

  let control
  switch (field.type) {
    case 'boolean':
      control = (
        <input
          {...common}
          type="checkbox"
          checked={value === 'true' || value === true}
          onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
        />
      )
      break
    case 'textarea':
    case 'lines':
      control = (
        <textarea
          {...common}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={field.placeholder}
        />
      )
      break
    case 'select':
      control = (
        <select
          {...common}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {field.options.map(([optionValue, optionLabel]) => (
            <option key={optionValue} value={optionValue}>
              {optionLabel}
            </option>
          ))}
        </select>
      )
      break
    case 'number':
      control = (
        <input
          {...common}
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          min={field.min}
          max={field.max}
          step={field.step ?? 'any'}
        />
      )
      break
    case 'range':
    case 'money-range':
      control = (
        <input
          {...common}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          placeholder={field.placeholder}
        />
      )
      break
    default:
      control = (
        <input
          {...common}
          type={field.type || 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
        />
      )
  }

  return (
    <div className={`form-field ${field.wide ? 'wide' : ''} ${field.type === 'boolean' ? 'checkbox-field' : ''} ${error ? 'has-error' : ''}`}>
      {field.type === 'boolean' ? (
        <div className="checkbox-wrapper">
          {control}
          <label htmlFor={id}>{field.label}</label>
        </div>
      ) : (
        <>
          <label htmlFor={id}>{field.label}</label>
          {control}
        </>
      )}
      {error ? <small className="field-error">{error}</small> : field.hint && <small>{field.hint}</small>}
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

function Chip({ label, value, tone }) {
  return (
    <span className={`chip chip-${tone}`}>
      <span className="chip-label">{label}</span> {value}
    </span>
  )
}

const RULE_TONE = { allowed: 'good', restricted: 'warn', 'not-allowed': 'bad', unknown: 'unknown' }
const TRI_TONE = { yes: 'good', no: 'bad', unknown: 'unknown' }
const LAUNDRY_TONE = { 'in-unit': 'good', hookups: 'good', none: 'bad', unknown: 'unknown' }

function DetailView({ listing }) {
  const contact = listing.contact || {}
  const hasContact = contact.company || contact.phone || contact.email
  const pets = listing.pets || {}
  const amenities = listing.amenities || {}
  const fit = petFit(pets)

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
        <p>
          {[formatRent(listing.rent) || 'Rent unknown', formatLayout(listing), PROPERTY_TYPE_LABELS[listing.propertyType]]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {listing.rent?.note && <p className="subtle">{listing.rent.note}</p>}
        {listing.score != null && <p className="subtle">Score: {listing.score}/5</p>}
      </Section>

      <Section title="Pets">
        <div className="chip-row">
          <span className={`chip chip-fit pets-${fit}`}>{PET_FIT_LABELS[fit]} for us</span>
          <Chip label="Cats" value={PET_RULE_LABELS[pets.cats]} tone={RULE_TONE[pets.cats]} />
          <Chip label="Dogs" value={PET_RULE_LABELS[pets.dogs]} tone={RULE_TONE[pets.dogs]} />
        </div>
        {pets.notes && <p className="subtle">{pets.notes}</p>}
      </Section>

      <Section title="Amenities">
        <div className="chip-row">
          <Chip
            label={AMENITY_LABELS.laundry}
            value={LAUNDRY_LABELS[amenities.laundry]}
            tone={LAUNDRY_TONE[amenities.laundry]}
          />
          {['ac', 'dishwasher', 'garage', 'outdoorSpace'].map((key) => (
            <Chip
              key={key}
              label={AMENITY_LABELS[key]}
              value={TRI_STATE_LABELS[amenities[key]]}
              tone={TRI_TONE[amenities[key]]}
            />
          ))}
        </div>
        {listing.confirmedAmenities && <p className="subtle">{listing.confirmedAmenities}</p>}
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
  const [fieldErrors, setFieldErrors] = useState({})
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
    setFieldErrors({})
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
    const errors = validateDraft(draft)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setError('Fix the highlighted fields before saving.')
      return
    }
    // Fall back to the street address as the name.
    const finalDraft = name ? draft : { ...draft, name: address.split(',')[0].trim() }
    onSaveEdits(diffEdits(seed, finalDraft))
    setError(null)
    setFieldErrors({})
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
                          error={fieldErrors[field.key]}
                          onChange={(value) => {
                            setDraft((d) => ({ ...d, [field.key]: value }))
                            if (fieldErrors[field.key]) {
                              setFieldErrors(({ [field.key]: _, ...rest }) => rest)
                            }
                          }}
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
