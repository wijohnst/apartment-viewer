import { useState } from 'react'
import { formatRent, formatLayout } from '../utils/format.js'

const TIGHT_GAP_MINUTES = 60
// An appointment stays in "upcoming" until this long after its start time.
const IN_PROGRESS_MINUTES = 60

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
const shortDayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function dayLabel(date, now) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const that = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((that - today) / 86400000)
  if (diffDays === 0) return `Today · ${dayFmt.format(date)}`
  if (diffDays === 1) return `Tomorrow · ${dayFmt.format(date)}`
  return dayFmt.format(date)
}

function directionsUrl(address) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
}

function formatGap(minutes) {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} hr ${m} min` : `${h} hr`
}

function AppointmentRow({ item, date, warning, showDay, onOpen }) {
  const { listing } = item
  const thumb = listing.images && listing.images[0]
  return (
    <div
      className="appt-row"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
    >
      <div className="appt-time">
        {showDay && <span className="appt-day">{shortDayFmt.format(date)}</span>}
        {date ? timeFmt.format(date) : '—'}
      </div>
      <div className="appt-thumb">{thumb ? <img src={thumb} alt="" /> : null}</div>
      <div className="appt-info">
        <div className="appt-name">{listing.name}</div>
        <div className="appt-address">{listing.address}</div>
        <div className="appt-meta">{[formatRent(listing.rent), formatLayout(listing)].filter(Boolean).join(' · ')}</div>
        {warning && <div className="appt-warning">⚠ {warning}</div>}
      </div>
      {listing.address && (
        <a
          className="appt-directions"
          href={directionsUrl(listing.address)}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          Directions
        </a>
      )}
    </div>
  )
}

// items: [{ listing, entry, seed }] (already search-filtered by the caller).
export function scheduleCounts(items, now = new Date()) {
  let upcoming = 0
  items.forEach(({ entry }) => {
    if (entry.status !== 'accepted' || !entry.appointment?.dateTime) return
    const d = new Date(entry.appointment.dateTime)
    if (!Number.isNaN(d.getTime()) && d.getTime() >= now.getTime() - IN_PROGRESS_MINUTES * 60000) upcoming++
  })
  return { upcoming }
}

export default function ScheduleView({ items, onOpen, now = new Date() }) {
  const [showPast, setShowPast] = useState(false)

  const accepted = items.filter(({ entry }) => entry.status === 'accepted')
  const scheduled = accepted
    .filter(({ entry }) => entry.appointment?.dateTime)
    .map((item) => ({ item, date: new Date(item.entry.appointment.dateTime) }))
    .filter(({ date }) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.date - b.date)
  const unscheduled = accepted.filter(({ entry }) => !entry.appointment?.dateTime)

  const cutoff = now.getTime() - IN_PROGRESS_MINUTES * 60000
  const upcoming = scheduled.filter(({ date }) => date.getTime() >= cutoff)
  const past = scheduled.filter(({ date }) => date.getTime() < cutoff).reverse()

  // Group upcoming by day, flagging appointments that start soon after the
  // previous one that day.
  const days = []
  upcoming.forEach((appt) => {
    const key = dayKey(appt.date)
    let day = days[days.length - 1]
    if (!day || day.key !== key) {
      day = { key, date: appt.date, appts: [] }
      days.push(day)
    }
    const prev = day.appts[day.appts.length - 1]
    let warning = null
    if (prev) {
      const gap = Math.round((appt.date - prev.date) / 60000)
      if (gap < TIGHT_GAP_MINUTES) {
        warning =
          gap <= 0
            ? `Same time as ${prev.item.listing.name}`
            : `Only ${formatGap(gap)} after ${prev.item.listing.name}`
      }
    }
    day.appts.push({ ...appt, warning })
  })

  if (accepted.length === 0) {
    return (
      <div className="empty-state">
        No accepted listings yet. Accept a listing and set an appointment time to see it here.
      </div>
    )
  }

  return (
    <div className="schedule">
      {days.length === 0 ? (
        <p className="subtle schedule-empty">No upcoming appointments.</p>
      ) : (
        days.map((day) => (
          <section className="schedule-day" key={day.key}>
            <h3>
              {dayLabel(day.date, now)}
              <span className="schedule-count">
                {day.appts.length} {day.appts.length === 1 ? 'viewing' : 'viewings'}
              </span>
            </h3>
            <div className="appt-list">
              {day.appts.map((appt) => (
                <AppointmentRow
                  key={appt.item.seed.id}
                  item={appt.item}
                  date={appt.date}
                  warning={appt.warning}
                  onOpen={() => onOpen(appt.item.seed.id)}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {unscheduled.length > 0 && (
        <section className="schedule-day">
          <h3>
            Accepted — not scheduled yet
            <span className="schedule-count">{unscheduled.length}</span>
          </h3>
          <div className="appt-list">
            {unscheduled.map((item) => (
              <AppointmentRow
                key={item.seed.id}
                item={item}
                date={null}
                warning={null}
                onOpen={() => onOpen(item.seed.id)}
              />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className="schedule-day schedule-past">
          <h3>
            <button type="button" className="past-toggle" onClick={() => setShowPast((v) => !v)}>
              {showPast ? '▾' : '▸'} Past appointments
            </button>
            <span className="schedule-count">{past.length}</span>
          </h3>
          {showPast && (
            <div className="appt-list">
              {past.map((appt) => (
                <AppointmentRow
                  key={appt.item.seed.id}
                  item={appt.item}
                  date={appt.date}
                  showDay
                  warning={null}
                  onOpen={() => onOpen(appt.item.seed.id)}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
