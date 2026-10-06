import {
  ChevronDown,
  ChevronUp,
  Printer,
  Search,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import useAsyncData from "../hooks/useAsyncData";
import { getActiveTabloid, tabloidCampaignName } from "../services/tabloid";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
const stores = ["307", "212", "600", "120", "033", "018"];
const labels = {
  307: "01 · 307",
  212: "02 · 212",
  600: "03 · 600",
  120: "04 · 120",
  "033": "05 · 033",
  "018": "06 · 018",
};
const format = (value, mode) =>
  mode === "sales" ? money.format(value) : number.format(value);
const date = (value) =>
  value
    ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${value}T12:00:00`))
    : "-";

function aggregate(products) {
  const families = new Map();
  for (const row of products) {
    const family = families.get(row.family_key) || {
      key: row.family_key,
      name: row.family_name,
      quantity: 0,
      sales: 0,
      stores: new Map(),
      variants: new Map(),
      rows: [],
    };
    const quantity = Number(row.quantity) || 0;
    const sales = Number(row.sales_value) || 0;
    const familyStore = family.stores.get(row.store_code) || {
      quantity: 0,
      sales: 0,
      name: row.store_name,
    };
    familyStore.quantity += quantity;
    familyStore.sales += sales;
    family.stores.set(row.store_code, familyStore);
    const variantKey = `${row.product_code}:${row.product_name}`;
    const variant = family.variants.get(variantKey) || {
      key: variantKey,
      name: row.variant_name || row.product_name,
      productCode: row.product_code,
      quantity: 0,
      sales: 0,
      stores: new Map(),
    };
    const variantStore = variant.stores.get(row.store_code) || {
      quantity: 0,
      sales: 0,
      name: row.store_name,
    };
    variantStore.quantity += quantity;
    variantStore.sales += sales;
    variant.stores.set(row.store_code, variantStore);
    variant.quantity += quantity;
    variant.sales += sales;
    family.variants.set(variantKey, variant);
    family.quantity += quantity;
    family.sales += sales;
    family.rows.push(row);
    families.set(row.family_key, family);
  }
  return [...families.values()].map((family) => ({
    ...family,
    variants: [...family.variants.values()],
  }));
}

function extremes(item, mode) {
  const values = stores
    .map((code) => item.stores.get(code)?.[mode] || 0)
    .filter(Boolean);
  return {
    max: Math.max(0, ...values),
    min: Math.min(...values),
    average: values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0,
  };
}

function MatrixRow({ item, mode, variant = false }) {
  const { max, min, average } = extremes(item, mode);
  return (
    <div
      className={`tabloid-matrix-row ${variant ? "tabloid-variant-row" : ""}`}
    >
      <div className="tabloid-product-cell">
        <strong>{item.name}</strong>
        <small>
          {variant
            ? `Cód. ${item.productCode}`
            : `${item.variants.length} variantes`}
        </small>
        {!variant ? (
          <em className="tabloid-mobile-toggle">Ver variantes</em>
        ) : null}
      </div>
      <strong className="tabloid-total-cell">{format(item[mode], mode)}</strong>
      {stores.map((code) => {
        const store = item.stores.get(code);
        const value = store?.[mode] || 0;
        const tone =
          value && value === max
            ? "is-best"
            : value && value === min && max !== min
              ? "is-low"
              : "";
        const delta = average
          ? `${value >= average ? "+" : ""}${((value / average - 1) * 100).toFixed(1)}% da média`
          : "Sem venda";
        return (
          <span
            key={code}
            data-label={labels[code]}
            className={`tabloid-store-cell ${tone}`}
            title={`${store?.name || `Loja ${code}`} · ${format(value, mode)} · ${delta}`}
          >
            {value ? format(value, mode) : "—"}
          </span>
        );
      })}
    </div>
  );
}

function Matrix({ groups, mode, expanded, setExpanded, sort, setSort }) {
  const sorted = useMemo(
    () =>
      [...groups].sort((a, b) => {
        const value = (item) =>
          sort.key === "total"
            ? item[mode]
            : item.stores.get(sort.key)?.[mode] || 0;
        return (value(b) - value(a)) * sort.direction;
      }),
    [groups, mode, sort],
  );
  const changeSort = (key) =>
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction * -1 }
        : { key, direction: 1 },
    );
  const arrow = (key) =>
    sort.key === key ? (
      sort.direction === 1 ? (
        <ChevronDown size={14} />
      ) : (
        <ChevronUp size={14} />
      )
    ) : null;
  return (
    <section className="tabloid-comparative">
      <div className="tabloid-matrix tabloid-matrix-head">
        <div>Produto</div>
        <button onClick={() => changeSort("total")}>
          Total {arrow("total")}
        </button>
        {stores.map((code) => (
          <button
            key={code}
            onClick={() => changeSort(code)}
            title={`Ordenar pela loja ${labels[code]}`}
          >
            {labels[code]} {arrow(code)}
          </button>
        ))}
      </div>
      <div className="tabloid-matrix-body">
        {sorted.map((group) => (
          <div className="tabloid-matrix-family" key={group.key}>
            <button
              className="tabloid-expand"
              onClick={() =>
                setExpanded(expanded === group.key ? null : group.key)
              }
              aria-expanded={expanded === group.key}
            >
              <MatrixRow item={group} mode={mode} />
              <ChevronDown
                className={expanded === group.key ? "expanded" : ""}
                size={17}
              />
            </button>
            {expanded === group.key ? (
              <div className="tabloid-variants-matrix">
                {group.variants.map((variant) => (
                  <MatrixRow
                    item={variant}
                    mode={mode}
                    variant
                    key={variant.key}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function Ranking({ groups, totalSales }) {
  return (
    <section className="tabloid-ranking-list">
      <div className="tabloid-ranking-head">
        <span>#</span>
        <span>Produto</span>
        <span>Quantidade</span>
        <span>Venda</span>
        <span>Participação</span>
      </div>
      {[...groups]
        .sort((a, b) => b.sales - a.sales)
        .map((group, index) => (
          <div className="tabloid-ranking-row" key={group.key}>
            <span>{index + 1}</span>
            <strong>{group.name}</strong>
            <span>{number.format(group.quantity)}</span>
            <strong>{money.format(group.sales)}</strong>
            <span>
              {totalSales
                ? `${((group.sales / totalSales) * 100).toFixed(2)}%`
                : "—"}
            </span>
          </div>
        ))}
    </section>
  );
}

function Detail({ groups, mode }) {
  const [selected, setSelected] = useState(null);
  const item = selected || groups[0];
  if (!item) return <EmptyState message="Nenhum produto encontrado." />;
  return (
    <section className="tabloid-detail">
      <div className="tabloid-detail-picker">
        {groups.slice(0, 20).map((group) => (
          <button
            className={group.key === item.key ? "active" : ""}
            key={group.key}
            onClick={() => setSelected(group)}
          >
            {group.name}
          </button>
        ))}
      </div>
      <article className="tabloid-detail-card">
        <span className="section-kicker">ANÁLISE DO PRODUTO</span>
        <h2>{item.name}</h2>
        <div className="tabloid-detail-kpis">
          <span>
            <small>
              {mode === "sales" ? "Venda total" : "Quantidade total"}
            </small>
            <strong>{format(item[mode], mode)}</strong>
          </span>
          <span>
            <small>Variantes</small>
            <strong>{item.variants.length}</strong>
          </span>
          <span>
            <small>Lojas com venda</small>
            <strong>
              {
                [...item.stores.values()].filter((store) => store[mode] > 0)
                  .length
              }
            </strong>
          </span>
        </div>
        <h3>Desempenho por loja</h3>
        <div className="tabloid-store-detail">
          {stores.map((code) => {
            const store = item.stores.get(code);
            return (
              <div
                className={
                  store?.[mode] === extremes(item, mode).max && store
                    ? "is-best"
                    : ""
                }
                key={code}
              >
                <span>{labels[code]}</span>
                <strong>{format(store?.[mode] || 0, mode)}</strong>
                <small>{store?.name || "Sem venda"}</small>
              </div>
            );
          })}
        </div>
      </article>
    </section>
  );
}

export default function TabloidPage() {
  const { data, loading, error, refresh } = useAsyncData(getActiveTabloid, []);
  const [tab, setTab] = useState("comparativo");
  const [mode, setMode] = useState("quantity");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [sort, setSort] = useState({ key: "total", direction: 1 });
  const groups = useMemo(() => aggregate(data?.products || []), [data]);
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return term
      ? groups.filter((group) =>
          `${group.name} ${group.rows.map((row) => `${row.product_name} ${row.variant_name} ${row.product_code}`).join(" ")}`
            .toLocaleLowerCase("pt-BR")
            .includes(term),
        )
      : groups;
  }, [groups, query]);
  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={refresh} />;
  if (!data?.campaign)
    return (
      <EmptyState message="Nenhuma campanha de tabloide ativa foi configurada." />
    );
  const totalSales = data.products.reduce(
    (sum, item) => sum + Number(item.sales_value),
    0,
  );
  const totalQuantity = data.products.reduce(
    (sum, item) => sum + Number(item.quantity),
    0,
  );
  const leader = [...stores]
    .map((code) => ({
      code,
      sales: data.products
        .filter((item) => item.store_code === code)
        .reduce((sum, item) => sum + Number(item.sales_value), 0),
    }))
    .sort((a, b) => b.sales - a.sales)[0];
  const leaderShare = leader?.sales ? (leader.sales / totalSales) * 100 : 0;
  const now = new Date();
  const parseDay = (value) => {
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  const startDay = parseDay(data.campaign.start_date);
  const endDay = parseDay(data.campaign.end_date);
  const todayDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((endDay - startDay) / 86400000) + 1;
  const elapsed = Math.min(
    days,
    Math.max(0, Math.floor((todayDay - startDay) / 86400000) + 1),
  );
  const status =
    todayDay < startDay
      ? "Agendado"
      : todayDay > endDay
        ? "Finalizada"
        : "Em andamento";
  return (
    <div className="page tabloid-page page-tight">
      <header className="page-header dashboard-hero page-header-compact tabloid-hero">
        <div className="page-header-copy dashboard-hero-copy">
          <span className="section-kicker">TABLOIDE</span>
          <h1>{tabloidCampaignName(data.campaign.start_date, data.campaign.end_date)}</h1>
          <p>
            {date(data.campaign.start_date)} → {date(data.campaign.end_date)}{" "}
            <span className="tabloid-status">{status}</span>
          </p>
          <small className="tabloid-updated">
            {data.snapshot ? (
              <>
                Resultado disponível até {date(data.availableThrough || data.snapshot?.period_end)}
                {data.awaitingUpdate ? " · aguardando atualização mais recente" : ""}
              </>
            ) : (
              "Aguardando a primeira coleta do período"
            )}
          </small>
        </div>
        <ShoppingCart size={28} />
      </header>
      <section className="tabloid-kpi-grid">
        <article>
          <TrendingUp size={20} />
          <span>Venda do tabloide</span>
          <strong>{money.format(totalSales)}</strong>
        </article>
        <article>
          <ShoppingCart size={20} />
          <span>Quantidade vendida</span>
          <strong>{number.format(totalQuantity)}</strong>
        </article>
        <article className="tabloid-kpi-leader">
          <TrendingUp size={20} />
          <span>Loja com maior venda</span>
          <strong>{leader ? `Loja ${leader.code}` : "—"}</strong>
          <small>
            {leader
              ? `${money.format(leader.sales)} · ${leaderShare.toFixed(1)}% do total`
              : "Sem dados"}
          </small>
        </article>
      </section>
      <section className="tabloid-toolbar">
        <div className="tabloid-tabs" role="tablist">
          <button
            className={tab === "comparativo" ? "active" : ""}
            onClick={() => setTab("comparativo")}
          >
            Comparativo
          </button>
          <button
            className={tab === "ranking" ? "active" : ""}
            onClick={() => setTab("ranking")}
          >
            Ranking
          </button>
          <button
            className={tab === "pesquisa" ? "active" : ""}
            onClick={() => setTab("pesquisa")}
          >
            Pesquisa
          </button>
        </div>
        <div className="tabloid-mode">
          <span>Visualizar por:</span>
          <button
            className={mode === "quantity" ? "active" : ""}
            onClick={() => setMode("quantity")}
          >
            Quantidade
          </button>
          <button
            className={mode === "sales" ? "active" : ""}
            onClick={() => setMode("sales")}
          >
            Venda R$
          </button>
        </div>
        <button className="tabloid-print" onClick={() => window.print()}>
          <Printer size={16} /> Imprimir
        </button>
      </section>
      <section className="tabloid-progress">
        <span>
          {status === "Finalizada"
            ? "Campanha finalizada"
            : `${elapsed} de ${days} dias concluídos`}
        </span>
        <div>
          <i
            style={{
              width: `${Math.min(100, days ? (elapsed / days) * 100 : 0)}%`,
            }}
          />
        </div>
      </section>
      <label className="tabloid-search">
        <Search size={18} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={
            tab === "pesquisa"
              ? "Pesquisar produto do tabloide..."
              : "Pesquisar produto..."
          }
        />
      </label>
      {tab === "comparativo" ? (
        <Matrix
          groups={filtered}
          mode={mode}
          expanded={expanded}
          setExpanded={setExpanded}
          sort={sort}
          setSort={setSort}
        />
      ) : null}
      {tab === "ranking" ? (
        <Ranking groups={filtered} totalSales={totalSales} />
      ) : null}
      {tab === "pesquisa" ? <Detail groups={filtered} mode={mode} /> : null}
    </div>
  );
}
