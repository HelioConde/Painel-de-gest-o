function balanceColumns(items) {
  const columns = [[], []]
  const weights = [0, 0]
  items.forEach((item) => {
    const index = weights[0] <= weights[1] ? 0 : 1
    columns[index].push(item)
    weights[index] += Math.max(3, (item.products?.length || 0) + 1.6)
  })
  return columns
}

export default function LossRankingGrid({ items, renderItem, label }) {
  const columns = balanceColumns(items)
  return (
    <div className="loss-top-masonry loss-ranking-grid" aria-label={label}>
      {columns.map((column, columnIndex) => (
        <div className="loss-top-column" key={`column-${columnIndex}`}>
          {column.map(renderItem)}
        </div>
      ))}
    </div>
  )
}
