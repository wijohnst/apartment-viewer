import { CATEGORY_LABELS, STATUS_LABELS } from '../constants.js'

export default function ListingCard({ listing, status, edited, onOpen }) {
  const thumbnail = listing.images && listing.images[0]

  return (
    <div
      className="card"
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
      <div className="card-image">
        {thumbnail ? <img src={thumbnail} alt={listing.name} /> : <span>No image yet</span>}
      </div>
      <div className="card-body">
        <div className="card-title">{listing.name}</div>
        <div className="card-address">{listing.address}</div>
        <div className="card-meta">
          <span>{listing.rent}</span>
          <span>{listing.bedsBaths}</span>
        </div>
        <div className="badge-row">
          <span className={`badge status-${status}`}>{STATUS_LABELS[status] || status}</span>
          <span className="badge">{CATEGORY_LABELS[listing.category] || listing.category}</span>
          {listing.score != null && <span className="badge">Score {listing.score}/5</span>}
          {edited && <span className="badge edited">Edited</span>}
        </div>
      </div>
    </div>
  )
}
