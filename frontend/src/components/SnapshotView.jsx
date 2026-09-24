import EventStoreComparison from './EventStoreComparison'
import StoreTableCarousel from './StoreTableCarousel'

export default function SnapshotView({ snapshot, eventMeta, reportTitle, onRefresh, refreshing = false }) {
  const isEvent = snapshot?.snapshot_type === 'EVENT'

  if (isEvent) {
    return <EventStoreComparison snapshot={snapshot} eventMeta={eventMeta} reportTitle={reportTitle} />
  }

  return (
    <StoreTableCarousel
      snapshot={snapshot}
      reportTitle={reportTitle}
      onRefresh={onRefresh}
      refreshing={refreshing}
    />
  )
}
