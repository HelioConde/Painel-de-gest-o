import {
  Apple,
  Beef,
  BriefcaseBusiness,
  ChefHat,
  CircleDollarSign,
  Flower2,
  GlassWater,
  Leaf,
  Package,
  Pizza,
  ShoppingBasket,
  ShoppingCart,
  SprayCan,
  Store,
  TrendingDown,
  TrendingUp,
  UtensilsCrossed,
  Waves,
} from "lucide-react";
import { money, percent } from "../../utils/formatters";

const SECTOR_ICONS = [
  ["ACOUGUE", Beef],
  ["BAZAR", ShoppingBag],
  ["BEBIDA", GlassWater],
  ["EMPORIO", ShoppingBasket],
  ["FAST FOOD", UtensilsCrossed],
  ["FLORICULTURA", Flower2],
  ["FLV", Leaf],
  ["HIGIENE", SprayCan],
  ["HORTIFRUTI", Apple],
  ["LIMPEZA", SprayCan],
  ["MERCEARIA", ShoppingCart],
  ["PADARIA", ChefHat],
  ["PEIX", Waves],
  ["PEREC", Package],
  ["PIZZ", Pizza],
  ["ROTISSERIA", BriefcaseBusiness],
  ["SUSHI", UtensilsCrossed],
];

function ShoppingBag(props) {
  return <BriefcaseBusiness {...props} />;
}

function sectorTone(label) {
  if (label.includes("ACOUGUE")) return "red";
  if (label.includes("BAZAR")) return "blue";
  if (label.includes("BEBIDA")) return "cyan";
  if (label.includes("EMPORIO")) return "amber";
  if (label.includes("FAST FOOD")) return "orange";
  if (label.includes("FLORICULTURA")) return "pink";
  if (label.includes("FLV")) return "green";
  if (label.includes("HIGIENE")) return "sky";
  if (label.includes("HORTIFRUTI")) return "emerald";
  if (label.includes("LIMPEZA")) return "teal";
  if (label.includes("MERCEARIA")) return "indigo";
  if (label.includes("PADARIA")) return "gold";
  if (label.includes("PEIX")) return "ocean";
  if (label.includes("PEREC")) return "violet";
  if (label.includes("PIZZ")) return "tomato";
  if (label.includes("ROTISSERIA")) return "brown";
  if (label.includes("SUSHI")) return "slate";
  return "blue";
}

export function SectorIcon({ name, size = 16 }) {
  const label = String(name || "").toLocaleUpperCase("pt-BR");
  const Icon = SECTOR_ICONS.find(([key]) => label.includes(key))?.[1] || Store;
  return (
    <span className={`sector-icon sector-icon-${sectorTone(label)}`} aria-hidden="true">
      <Icon size={size} />
    </span>
  );
}

export function StatusBadge({ value, className = "" }) {
  const number = Number(value || 0);
  const tone = number > 0 ? "positive" : number < 0 ? "negative" : "neutral";
  const Icon =
    number > 0 ? TrendingUp : number < 0 ? TrendingDown : CircleDollarSign;
  return (
    <span className={`status-badge ${tone} ${className}`.trim()}>
      <Icon size={13} />
      {percent(number)}
    </span>
  );
}

export function ComparisonBadge({ children, tone = "info" }) {
  return <span className={`comparison-badge ${tone}`}>{children}</span>;
}

export function KpiCard({
  label,
  value,
  detail,
  trend,
  icon: Icon = CircleDollarSign,
  tone = "blue",
}) {
  return (
    <article className={`kpi-card kpi-${tone}`}>
      <div className="kpi-card-top">
        <span>{label}</span>
        <i>
          <Icon size={18} />
        </i>
      </div>
      <strong>{value}</strong>
      <small>
        {trend === undefined ? (
          detail
        ) : (
          <>
            <StatusBadge value={trend} />
            {detail ? <em>{detail}</em> : null}
          </>
        )}
      </small>
    </article>
  );
}

export function SectionCard({
  title,
  eyebrow,
  action,
  className = "",
  children,
}) {
  return (
    <section className={`section-card ${className}`.trim()}>
      {(title || eyebrow || action) && (
        <header className="section-card-header">
          <div>
            {eyebrow ? <span>{eyebrow}</span> : null}
            {title ? <h2>{title}</h2> : null}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function ChartCard({ title, eyebrow, children, className = "" }) {
  return (
    <SectionCard
      title={title}
      eyebrow={eyebrow}
      className={`chart-card ${className}`}
    >
      {children}
    </SectionCard>
  );
}

export function SummaryStrip({ items }) {
  return (
    <section className="summary-strip">
      <span className="summary-strip-title">Resultado da loja</span>
      <div>
        {items.map((item) => (
          <article key={item.label}>
            <small>{item.label}</small>
            <strong className={item.tone ? `text-${item.tone}` : ""}>
              {item.value}
            </strong>
          </article>
        ))}
      </div>
    </section>
  );
}

export function SimpleBarChart({
  items = [],
  valueKey = "value",
  compareKey,
  format = money,
  limit = 6,
  toneBySign = false,
  empty = "Sem dados para exibir.",
}) {
  const visible = items.slice(0, limit);
  const hasComparison = compareKey !== undefined && compareKey !== null;
  const maximum = Math.max(
    1,
    ...visible.flatMap((item) => {
      const values = [Math.abs(Number(item[valueKey] || 0))];
      if (hasComparison) values.push(Math.abs(Number(item[compareKey] || 0)));
      return values;
    }),
  );
  if (!visible.length) return <p className="chart-empty">{empty}</p>;
  return (
    <div className="simple-bar-chart">
      {visible.map((item) => {
        const value = Number(item[valueKey] || 0);
        const comparison = hasComparison ? Number(item[compareKey] || 0) : null;
        return (
          <div
            className="simple-bar-row"
            key={item.id || item.name || item.setor}
          >
            <div className="simple-bar-label">
              {item.iconName ? <SectorIcon name={item.iconName} /> : null}
              <span>{item.name || item.setor}</span>
            </div>
            <div className="simple-bar-tracks">
              <i
                className={`bar-current ${toneBySign ? (value < 0 ? "bar-negative" : value > 0 ? "bar-positive" : "bar-neutral") : ""}`}
                style={{
                  width: `${Math.max(3, (Math.abs(value) / maximum) * 100)}%`,
                }}
              />
              {hasComparison ? (
                <i
                  className="bar-previous"
                  style={{
                    width: `${Math.max(3, (Math.abs(comparison) / maximum) * 100)}%`,
                  }}
                />
              ) : null}
            </div>
            <strong>{format(value)}</strong>
          </div>
        );
      })}
    </div>
  );
}
