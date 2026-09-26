import { FILTERS, EMPTY_FILTERS, activeFilterCount } from '../utils/filters.js'

export default function FilterBar({ filters, onChange }) {
  const count = activeFilterCount(filters)
  return (
    <div className="filter-bar">
      {FILTERS.map((filter) => {
        const value = filters[filter.key] || 'any'
        const id = `filter-${filter.key}`
        return (
          <div key={filter.key} className={`filter ${value !== 'any' ? 'active' : ''}`}>
            <label htmlFor={id}>{filter.label}</label>
            <select id={id} value={value} onChange={(e) => onChange({ ...filters, [filter.key]: e.target.value })}>
              {filter.options.map(([optionValue, optionLabel]) => (
                <option key={optionValue} value={optionValue}>
                  {optionLabel}
                </option>
              ))}
            </select>
          </div>
        )
      })}
      {count > 0 && (
        <button type="button" className="btn reset" onClick={() => onChange(EMPTY_FILTERS)}>
          Clear filters
        </button>
      )}
    </div>
  )
}
