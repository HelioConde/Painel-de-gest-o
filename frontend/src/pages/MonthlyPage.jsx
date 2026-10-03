import DataStatusBanner from "../components/DataStatusBanner";
import SnapshotView from "../components/SnapshotView";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import useAsyncData from "../hooks/useAsyncData";
import { getLatestMonthlySnapshot } from "../services/sales";

export default function MonthlyPage({ monthlyClose = false }) {
  const title = monthlyClose ? "Fechamento Mensal" : "Venda Mensal";
  const emptyMessage = monthlyClose
    ? "O fechamento mensal ainda não foi sincronizado."
    : "Ainda não existe uma venda mensal sincronizada.";
  const { data, loading, refreshing, error, refresh } = useAsyncData(
    () => getLatestMonthlySnapshot({ monthlyClose }),
    [monthlyClose],
  );

  return (
    <div className="page page-tight page-monthly page-view-enter">
      {loading && !data && <LoadingState />}
      {!loading && error && !data && (
        <ErrorState error={error} onRetry={refresh} />
      )}
      {!loading && !error && !data && <EmptyState message={emptyMessage} />}
      {data && <DataStatusBanner error={error} />}
      {data && (
        <SnapshotView
          snapshot={data}
          reportTitle={title}
          onRefresh={refresh}
          refreshing={refreshing}
        />
      )}
    </div>
  );
}
