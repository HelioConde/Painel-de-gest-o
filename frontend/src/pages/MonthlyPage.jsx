import DataStatusBanner from '../components/DataStatusBanner'
import PageHeader from '../components/PageHeader'
import SnapshotView from '../components/SnapshotView'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import useAsyncData from '../hooks/useAsyncData'
import { getLatestMonthlySnapshot } from '../services/sales'

export default function MonthlyPage() {
  const { data, loading, refreshing, error, refresh } = useAsyncData(getLatestMonthlySnapshot, [])

  return (
    <div className="page page-tight page-monthly page-view-enter">
      <PageHeader title="Venda Mensal" subtitle={null} snapshot={data} onRefresh={refresh} refreshing={refreshing} printOrientation="portrait" />
      {loading && !data && <LoadingState />}
      {!loading && error && !data && <ErrorState error={error} onRetry={refresh} />}
      {!loading && !error && !data && <EmptyState message="Ainda não existe uma venda mensal sincronizada." />}
      {data && <DataStatusBanner error={error} />}
      {data && <SnapshotView snapshot={data} reportTitle="Venda Mensal" />}
    </div>
  )
}
