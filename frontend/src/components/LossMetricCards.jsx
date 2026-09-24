import {
  ArrowUpRight,
  BadgePercent,
  CircleDollarSign,
  Layers3,
  Target,
} from "lucide-react";
import { money, percent } from "../utils/formatters";
import { KpiCard } from "./dashboard/DashboardPrimitives";

export default function LossMetricCards({ totals, sectorsAboveTarget = 0, sectorCount = 0 }) {
  const difference = Number(totals?.loss_difference || 0);
  const variation = Number(totals?.loss_variation_percent || 0);
  const lossSales = Number(totals?.current_loss_sales_percent || 0);
  const previousLossSales = Number(totals?.previous_loss_sales_percent || 0);

  return (
    <section className="kpi-grid loss-kpi-grid">
      <KpiCard
        label="Perda atual"
        value={money(totals?.current_total_value)}
        detail={null}
        trend={variation}
        icon={CircleDollarSign}
        tone="red"
      />
      <KpiCard
        label="Perda anterior"
        value={money(totals?.previous_total_value)}
        detail={null}
        icon={Layers3}
        tone="slate"
      />
      <KpiCard
        label="Diferença da perda"
        value={money(difference)}
        detail={null}
        trend={variation}
        icon={ArrowUpRight}
        tone={difference > 0 ? "orange" : "green"}
      />
      <KpiCard
        label="% perda / venda"
        value={percent(lossSales)}
        detail={`ant. ${percent(previousLossSales)}`}
        icon={BadgePercent}
        tone="purple"
      />
      <KpiCard
        label="Setores acima da meta"
        value={`${sectorsAboveTarget} de ${sectorCount}`}
        detail={null}
        icon={Target}
        tone={sectorsAboveTarget > 0 ? "amber" : "mint"}
      />
    </section>
  );
}
