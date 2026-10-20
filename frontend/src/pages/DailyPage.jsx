import { CalendarDays } from "lucide-react";
import { useState } from "react";
import DataStatusBanner from "../components/DataStatusBanner";
import SnapshotView from "../components/SnapshotView";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import useAsyncData from "../hooks/useAsyncData";
import {
  getAvailableDailySalesDates,
  getDailySalesSnapshot,
} from "../services/sales";
import "./DailyPage.css";

function formatSalesDate(isoDate) {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

function DailyReport({ salesDate }) {
  const { data, loading, refreshing, error, refresh } = useAsyncData(
    () => getDailySalesSnapshot(salesDate === "latest" ? null : salesDate),
    [salesDate],
  );

  const emptyMessage = salesDate === "latest"
    ? "Ainda não existe uma venda diária sincronizada."
    : `Não existe um relatório de venda diária para ${formatSalesDate(salesDate)}.`;

  return (
    <>
      {loading && !data && <LoadingState />}
      {!loading && error && !data && <ErrorState error={error} onRetry={refresh} />}
      {!loading && !error && !data && <EmptyState message={emptyMessage} />}
      {data && <DataStatusBanner error={error} />}
      {data && (
        <SnapshotView
          snapshot={data}
          reportTitle="Venda Diária"
          onRefresh={refresh}
          refreshing={refreshing}
        />
      )}
    </>
  );
}

export default function DailyPage() {
  const [selectedDate, setSelectedDate] = useState("latest");
  const {
    data: availableDates,
    loading: datesLoading,
    error: datesError,
    refresh: refreshDates,
  } = useAsyncData(getAvailableDailySalesDates, []);
  const dates = availableDates ?? [];

  return (
    <div className="page page-tight page-daily page-view-enter">
      <section className="daily-history-toolbar no-print" aria-label="Consultar venda diária por data">
        <div className="daily-history-info">
          <CalendarDays size={18} aria-hidden="true" />
          <div>
            <strong>Histórico de vendas</strong>
            <span>Consulte os dias com relatórios enviados ao sistema.</span>
          </div>
        </div>
        <div className="daily-history-actions">
          <label htmlFor="daily-sales-date">Data da venda</label>
          <select
            id="daily-sales-date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            aria-label="Selecionar data da venda diária"
          >
            <option value="latest">Relatório mais recente</option>
            {dates.map((date) => (
              <option key={date} value={date}>
                {formatSalesDate(date)}
              </option>
            ))}
          </select>
          {selectedDate !== "latest" && (
            <button
              type="button"
              className="daily-history-latest"
              onClick={() => setSelectedDate("latest")}
            >
              Voltar ao mais recente
            </button>
          )}
        </div>
      </section>

      {datesLoading && !availableDates && (
        <p className="daily-history-message" role="status">Carregando datas disponíveis...</p>
      )}
      {datesError && (
        <p className="daily-history-message daily-history-error" role="alert">
          Não foi possível carregar as datas do histórico.{" "}
          <button type="button" onClick={refreshDates}>Tentar novamente</button>
        </p>
      )}

      {/* A chave reinicia somente o relatório, impedindo que outra data
          apareça temporariamente enquanto a consulta histórica carrega. */}
      <DailyReport key={selectedDate} salesDate={selectedDate} />
    </div>
  );
}
