import DataStatusBanner from '../components/DataStatusBanner'
import PageHeader from '../components/PageHeader'
import SnapshotView from '../components/SnapshotView'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import useAsyncData from '../hooks/useAsyncData'
import { getLatestSnapshot } from '../services/sales'

export default function DailyPage() {
  const { data, loading, refreshing, error, refresh } = useAsyncData(
    () => getLatestSnapshot({ type: 'DAILY', slug: 'daily' }),
    [],
  )

  return (
    <div className="page page-tight page-daily page-view-enter">
      <PageHeader title="Venda Diária" subtitle={null} snapshot={data} onRefresh={refresh} refreshing={refreshing} printOrientation="portrait" />
      {loading && !data && <LoadingState />}
      {!loading && error && !data && <ErrorState error={error} onRetry={refresh} />}
      {!loading && !error && !data && <EmptyState message="Ainda não existe uma venda diária sincronizada." />}
      {data && <DataStatusBanner error={error} />}
      {data && <SnapshotView snapshot={data} reportTitle="Venda Diária" />}
    </div>
  )
}
