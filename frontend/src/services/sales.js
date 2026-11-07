import { supabase, supabaseConfigured } from "../lib/supabase";

const TABLE = "superus_period_snapshots";
const COLUMNS = [
  "snapshot_key",
  "reference_date",
  "snapshot_type",
  "slug",
  "event_slug",
  "event_name",
  "name",
  "mode",
  "metric",
  "unit",
  "current_start",
  "current_end",
  "previous_start",
  "previous_end",
  "current_value",
  "previous_value",
  "difference_value",
  "variation_percent",
  "sector_count",
  "store_count",
  "subgroup_count",
  "run_id",
  "details",
  "quality",
  "updated_at",
].join(",");

function ensureConfigured() {
  if (!supabaseConfigured) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }
}

export async function getLatestSnapshot({ type, slug }) {
  ensureConfigured();

  let query = supabase
    .from(TABLE)
    .select(COLUMNS)
    .eq("snapshot_type", type)
    .order("reference_date", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1);

  if (slug) query = query.eq("slug", slug);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function getLatestMonthlySnapshot({ monthlyClose = false } = {}) {
  ensureConfigured();

  let query = supabase
    .from(TABLE)
    .select(COLUMNS)
    .eq("snapshot_type", "MONTHLY")
    .eq("slug", "monthly")
    .order("reference_date", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1);

  query = query.eq("mode", monthlyClose ? "PREVIOUS_MONTH_CLOSE" : "RUNNING_MONTH");

  const { data, error } = await query.maybeSingle();

  if (error) throw error;
  return data ?? null;
}

const EVENT_SLUGS = [
  "segunda_pizza", "terca_carne", "quarta_quinta_verde", "sexta_pao", "fim_semana",
];

// Somente os cinco eventos exibidos; evita trazer 100 JSONs de historicos.
export async function getLatestEvents() {
  ensureConfigured();
  const rows = await Promise.all(EVENT_SLUGS.map(async (slug) => {
    const { data, error } = await supabase
      .from(TABLE)
      .select(COLUMNS)
      .eq("snapshot_type", "EVENT")
      .eq("slug", slug)
      .order("reference_date", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data ?? null;
  }));
  return rows.filter(Boolean);
}


// A data visível da venda diária é current_end: a coleta feita no dia
// seguinte usa reference_date para identificar o processamento.
// Ao instalar a view no Supabase, o banco deduplica as datas.
// Ate la, a consulta antiga continua disponivel sem perder historico.
let dailyDatesViewAvailable = true;

async function readDailyDates(source) {
  const dates = new Set();
  const pageSize = 500;
  let offset = 0;
  while (true) {
    let query = supabase.from(source).select("current_end");
    if (source === TABLE) {
      query = query
        .eq("snapshot_type", "DAILY")
        .eq("slug", "daily")
        .not("current_end", "is", null);
    }
    const { data, error } = await query
      .order("current_end", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const rows = data ?? [];
    for (const row of rows) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(row.current_end || "")) {
        dates.add(row.current_end);
      }
    }
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return [...dates].sort((a, b) => b.localeCompare(a));
}

export async function getAvailableDailySalesDates() {
  ensureConfigured();
  if (dailyDatesViewAvailable) {
    try {
      return await readDailyDates("daily_sales_available_dates");
    } catch (error) {
      // Table missing or absent from PostgREST schema cache.
      if (!["42P01", "PGRST205"].includes(error?.code)) throw error;
      dailyDatesViewAvailable = false;
    }
  }
  return readDailyDates(TABLE);
}

export async function getDailySalesSnapshot(salesDate = null) {
  if (!salesDate) return getLatestSnapshot({ type: "DAILY", slug: "daily" });
  ensureConfigured();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(salesDate)) {
    throw new Error("Data de venda inválida.");
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select(COLUMNS)
    .eq("snapshot_type", "DAILY")
    .eq("slug", "daily")
    .eq("current_end", salesDate)
    .order("reference_date", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}
