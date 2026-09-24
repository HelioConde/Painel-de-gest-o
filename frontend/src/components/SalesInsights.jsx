import { BarChart3, CircleDollarSign, Layers3, TrendingUp } from "lucide-react";
import { money, percent } from "../utils/formatters";
import { visibleSectors } from "../utils/snapshot";
import {
  ChartCard,
  KpiCard,
  SimpleBarChart,
  SummaryStrip,
} from "./dashboard/DashboardPrimitives";

const numeric = (value) => Number(value || 0);

export function SalesKpiGrid({ scope }) {
  const sectors = scope?.sectors || [];
  const current = numeric(scope?.current_value);
  const previous = numeric(scope?.previous_value);
  const difference = numeric(scope?.difference_value);
  const variation = numeric(scope?.variation_percent);
  const rising = sectors.filter(
    (sector) => numeric(sector.variation_percent) > 0,
  ).length;

  return (
    <section className="kpi-grid sales-kpi-grid">
      <KpiCard
        label="Venda atual"
        value={money(current)}
        detail={null}
        trend={variation}
        icon={CircleDollarSign}
        tone="green"
      />
      <KpiCard
        label="Venda anterior"
        value={money(previous)}
        detail={null}
        icon={Layers3}
        tone="slate"
      />
      <KpiCard
        label="Diferença"
        value={money(difference)}
        detail={null}
        trend={variation}
        icon={TrendingUp}
        tone="blue"
      />
      <KpiCard
        label="% variação"
        value={percent(variation)}
        detail={null}
        trend={variation}
        icon={BarChart3}
        tone="purple"
      />
      <KpiCard
        label="Setores em alta"
        value={`${rising} de ${sectors.length}`}
        detail={null}
        icon={TrendingUp}
        tone="mint"
      />
    </section>
  );
}

export function SalesSummary({ scope }) {
  if (!scope) return null;
  return (
    <SummaryStrip
      items={[
        { label: "Venda atual", value: money(scope.current_value) },
        { label: "Venda anterior", value: money(scope.previous_value) },
        {
          label: "Diferença",
          value: money(scope.difference_value),
          tone: numeric(scope.difference_value) >= 0 ? "positive" : "negative",
        },
        {
          label: "% variação",
          value: percent(scope.variation_percent),
          tone: numeric(scope.variation_percent) >= 0 ? "positive" : "negative",
        },
      ]}
    />
  );
}

export function SalesCharts({ snapshot, scope, monthly = false }) {
  const sectors = visibleSectors(snapshot, scope).map((sector) => ({
    name: sector.name,
    iconName: sector.name,
    value: numeric(sector.current_value),
    previous: numeric(sector.previous_value),
    difference: numeric(sector.difference_value),
  }));
  const bySales = [...sectors].sort((left, right) => right.value - left.value);
  const growing = [...sectors]
    .filter((item) => item.difference > 0)
    .sort((left, right) => right.difference - left.difference);
  const falling = [...sectors]
    .filter((item) => item.difference < 0)
    .sort((left, right) => left.difference - right.difference);

  return (
    <section className="dashboard-chart-grid sales-charts">
      <ChartCard
        eyebrow={monthly ? "COMPARAÇÃO DO PERÍODO" : "DETALHAMENTO"}
        title="Atual vs anterior por setor"
      >
        <SimpleBarChart
          items={bySales}
          valueKey="value"
          compareKey="previous"
        />
      </ChartCard>
      <ChartCard eyebrow="TOP 5" title="Maiores setores">
        <SimpleBarChart items={bySales} valueKey="value" />
      </ChartCard>
      {monthly ? (
        <>
          <ChartCard eyebrow="CRESCIMENTOS" title="Top avanços financeiros">
            <SimpleBarChart items={growing} valueKey="difference" />
          </ChartCard>
          <ChartCard eyebrow="ATENÇÃO" title="Maiores quedas">
            <SimpleBarChart
              items={falling}
              valueKey="difference"
              format={(value) => money(Math.abs(value))}
              empty="Nenhum setor em queda no período."
            />
          </ChartCard>
        </>
      ) : null}
    </section>
  );
}
