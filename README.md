# Salem Apartment Viewer

A small local React app for reviewing and deciding on Salem rental candidates,
replacing the "Salem Rental — Candidate Listings" Notion doc (which had
gotten too complicated to work with).

## Running it

```
npm install
npm run dev
```

Then open the local URL Vite prints (usually http://localhost:5173).

## Data model

Seed data lives in `src/data/listings.json`, migrated from the Notion doc's
tables (Zillow Favorites, Whole-Home Rentals, Confirmed Off-Market,
Apartments complex/community, Julia's List, Unverified, Disqualified). Each
listing has:

- `id` — stable slug, used as the localStorage key
- `name`, `address`
- `category` — which Notion table it came from (`zillow-favorite`,
  `whole-home`, `off-market`, `apartment-complex`, `julias-list`,
  `unverified`, `disqualified`)
- `propertyType`, `rent`, `bedsBaths`
- `source`, `sourceUrl` — where the listing was found and its live link
- `images` — array of image URLs; the first is the preview image
- `petPolicy`, `confirmedAmenities`, `toVerify`
- `contact` — `{ company, phone, email, notes }`
- `score` — the 0–5 rating, or `null`
- `researchNotes` — carried-over notes from the Notion research pass
- `seedStatus` — the `new` / `accepted` / `rejected` state
- `notes` — your notes on the listing (optional; defaults to empty)
- `appointment` — `{ dateTime }` for a booked viewing (optional)

## App-managed state (local persistence)

User decisions and edits are kept separately from the seed data, in
`localStorage` under `apartment-viewer/state/v1`, keyed by listing `id`:

```js
{
  status: 'new' | 'accepted' | 'rejected',
  appointment: { dateTime: string | null },
  notes: string,
  edits: { /* only fields changed from the seed, e.g. { rent: '$2,300', contact: { phone: '...' } } */ },
  custom: true,      // manual listings only
  createdAt: number, // manual listings only
}
```

Local state only holds what differs from `listings.json`. On load (and when
the file hot-reloads in dev), anything that now matches the file is pruned
automatically, so stale local edits can't override later changes to the
file.

## Exporting to listings.json

The app never writes files. **Export** (the button shows how many listings
have local changes) opens an overlay with the complete `listings.json` —
seed data with your edits merged in, manually added listings included, and
each listing's status, notes, and appointment baked in — pretty-printed,
with a **Copy** button. Paste it over `src/data/listings.json` locally or in
GitHub. After the updated file is loaded, the matching local changes clear
themselves.

Copy uses the Clipboard API where it's available (https, localhost). On plain
http (for example the dev server opened from a phone over the LAN) it falls
back to `document.execCommand('copy')`, and if that's blocked too it selects
the text so it can be copied by hand. The JSON is built by
`buildSeedFile()` in `src/utils/storage.js`.

## Editing listings

Every listing field is editable from the overlay ("Edit details"). Saves are
stored as `edits` — a diff against the seed record — so untouched fields
still pick up changes if `listings.json` is refreshed. Edited listings show an
"Edited" badge, and "Revert to original" drops the edits. Escape and clicking
the backdrop are disabled while editing so unsaved changes aren't lost. Field
definitions live in `FIELD_GROUPS` in `src/utils/listing.js`; add a field
there and it shows up in the form.

## Adding listings manually

"+ Add listing" opens a blank form. A name or an address is required (if
you leave the name blank, the street address is used). If the address matches
something already in the list, a warning shows before you save. Manual
listings live only in localStorage: they're stored as an entry with
`custom: true` whose `edits` hold all the data on top of a blank template
(`blankListing()` in `src/utils/listing.js`). They show up first, newest
first, with an "Added manually" badge, and have a "Delete listing" action in
the overlay (until they've been exported into the file, after which they're
regular listings).

## Schedule

The **Listings | Schedule** switch at the top flips to a schedule of viewing
appointments (linkable as `#schedule`). It shows accepted listings with an
appointment, grouped by day in time order (Today/Tomorrow labeled), and warns
when a viewing starts less than an hour after the previous one that day.
Accepted listings without a time are listed under "Accepted — not scheduled
yet", and past appointments are collapsed at the bottom. An appointment stays
in the upcoming list until an hour after its start. Rows open the listing
(where the time is edited) and have a Google Maps **Directions** link. The
search bar filters the schedule too. Code: `src/components/ScheduleView.jsx`.

## Search

The search bar (press `/` to focus, `Esc` to clear) fuzzy-matches across
name, address, category, status, rent, beds/baths, source, pet policy,
amenities, to-verify, research notes, contact info, and your own notes —
including edits. It's dependency-free (`src/utils/fuzzy.js`): exact
substrings rank highest, then typos ("mangolia" → Magnolia), then dropped
letters ("mgnlia"). Numbers only match exactly, so zips and rents don't
false-match. Every word in the query has to match somewhere; results sort
best-first and tab counts reflect the search.

## What's next

- Fill in `contact` info (phone/email) per property
- Add more detail fields as they come up
