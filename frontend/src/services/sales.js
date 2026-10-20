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

  if (monthlyClose) query = query.eq("mode", "PREVIOUS_MONTH_CLOSE");

  const { data, error } = await query.maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function getLatestEvents() {
  ensureConfigured();

  const { data, error } = await supabase
    .from(TABLE)
    .select(COLUMNS)
    .eq("snapshot_type", "EVENT")
    .order("reference_date", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  const latestBySlug = new Map();
  for (const row of data ?? []) {
    const slug = row.event_slug || row.slug;
    if (slug && !latestBySlug.has(slug)) latestBySlug.set(slug, row);
  }

  return [...latestBySlug.values()];
}


// A data visível da venda diária é current_end: a coleta feita no dia
// seguinte usa reference_date para identificar o processamento.
export async function getAvailableDailySalesDates() {
  ensureConfigured();

  const dates = new Set();
  const pageSize = 500;
  let offset = 0;

  // A paginação evita perder dias antigos ao atingir o limite de linhas do PostgREST.
  while (true) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("current_end")
      .eq("snapshot_type", "DAILY")
      .eq("slug", "daily")
      .not("current_end", "is", null)
      .order("current_end", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    const rows = data ?? [];
    rows.forEach((row) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(row.current_end || "")) {
        dates.add(row.current_end);
      }
    });
    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  return [...dates].sort((a, b) => b.localeCompare(a));
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
