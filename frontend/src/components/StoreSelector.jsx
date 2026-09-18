import { Building2 } from 'lucide-react'
import { getStoreOptions } from '../utils/snapshot'

export default function StoreSelector({ snapshot, value, onChange }) {
  const options = getStoreOptions(snapshot)

  return (
    <label className="store-selector">
      <span><Building2 size={15} /> Loja</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}
