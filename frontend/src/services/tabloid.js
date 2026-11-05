import { supabase, supabaseConfigured } from "../lib/supabase";
import { collectPages } from "../utils/collectPages.js";

function configured() {
  if (!supabaseConfigured || !supabase)
    throw new Error("SUPABASE_NOT_CONFIGURED");
}

export function tabloidCampaignName(startDate, endDate) {
  const formatDate = (value) =>
    value
      ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${value}T12:00:00`))
      : "—";
  return `TABLOIDE ${formatDate(startDate)} a ${formatDate(endDate)}`;
}

export async function getActiveTabloid() {
  configured();

  const now = new Date();
  const localToday = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");

  // A página deve mostrar a campanha cujo período inclui HOJE.
  // Isso evita que uma campanha futura marcada como "ativa" esconda
  // o tabloide que ainda está em andamento.
  let { data: campaign, error } = await supabase
    .from("tabloid_campaigns")
    .select("*")
    .lte("start_date", localToday)
    .gte("end_date", localToday)
    .order("start_date", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  if (!campaign) return { campaign: null, snapshot: null, products: [] };

  // Durante o período do tabloide, sempre mantemos visível o último
  // resultado válido já coletado. A tela não fica vazia apenas porque
  // a coleta do dia atual ainda não terminou.
  const validUntil =
    localToday < campaign.end_date ? localToday : campaign.end_date;

  let { data: snapshot, error: snapshotError } = await supabase
    .from("tabloid_snapshots")
    .select("*")
    .eq("campaign_id", campaign.id)
    .gte("reference_date", campaign.start_date)
    .lte("reference_date", validUntil)
    .order("reference_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (snapshotError) throw snapshotError;

  // Se a campanha foi recriada/reativada no admin, o histórico pode estar
  // vinculado a outro campaign_id. Nesse caso reaproveitamos o último
  // snapshot do MESMO período real do tabloide, sem misturar campanhas
  // com data inicial diferente e sem consultar datas futuras.
  if (!snapshot) {
    const { data: periodSnapshot, error: periodSnapshotError } = await supabase
      .from("tabloid_snapshots")
      .select("*")
      .eq("period_start", campaign.start_date)
      .lte("period_end", validUntil)
      .order("period_end", { ascending: false })
      .order("reference_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (periodSnapshotError) throw periodSnapshotError;
    snapshot = periodSnapshot;
  }

  if (!snapshot)
    return {
      campaign,
      snapshot: null,
      products: [],
      availableThrough: null,
      awaitingUpdate: true,
    };

  // Uma campanha pode exceder o limite padrao do PostgREST (1000 linhas).
  // A ordem composta garante paginacao estavel mesmo com vendas iguais.
  const products = await collectPages((from, to) =>
    supabase
      .from("tabloid_product_sales")
      .select("id,store_code,store_name,product_code,product_name,family_key,family_name,package_size,variant_name,quantity,sales_value")
      .eq("snapshot_id", snapshot.id)
      .order("sales_value", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to)
  );

  const availableThrough = snapshot.period_end || snapshot.reference_date;
  return {
    campaign,
    snapshot,
    products: products || [],
    availableThrough,
    awaitingUpdate: availableThrough < validUntil,
  };
}

export async function getTabloidSettings() {
  configured();
  const { data: campaigns, error } = await supabase
    .from("tabloid_campaigns")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const ids = (campaigns || []).map((campaign) => campaign.id);
  if (!ids.length) return { campaigns: [], snapshotsByCampaign: new Map() };

  // Configuracoes precisam apenas do ultimo snapshot por campanha.
  // Busca em pequenos lotes para nao transferir todo o historico.
  const snapshotsByCampaign = new Map();
  for (let index = 0; index < ids.length; index += 6) {
    const page = await Promise.all(ids.slice(index, index + 6).map(async (campaignId) => {
      const { data, error: snapshotError } = await supabase
        .from("tabloid_snapshots")
        .select("campaign_id,period_start,period_end,imported_at")
        .eq("campaign_id", campaignId)
        .order("imported_at", { ascending: false })
        .order("reference_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (snapshotError) throw snapshotError;
      return data;
    }));
    for (const snapshot of page) {
      if (snapshot) snapshotsByCampaign.set(snapshot.campaign_id, snapshot);
    }
  }
  return { campaigns: campaigns || [], snapshotsByCampaign };
}

export async function saveTabloidCampaign(values, userId) {
  configured();

  const now = new Date();
  const localToday = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");

  const isCurrent =
    values.start_date <= localToday && values.end_date >= localToday;

  // Regra de fila:
  // - campanha futura é cadastrada sem substituir a campanha atual;
  // - quando o dia inicial chegar, as telas e o worker passam a escolhê-la
  //   pelo período, sem exigir edição manual no admin;
  // - somente a campanha que está vigente hoje permanece com active=true
  //   para compatibilidade com dados antigos.
  const payload = {
    name: tabloidCampaignName(values.start_date, values.end_date),
    start_date: values.start_date,
    end_date: values.end_date,
    promotion_type: 1,
    promotion_name: "TABLOIDE",
    active: isCurrent,
  };

  if (isCurrent) {
    const { error: deactivateError } = await supabase
      .from("tabloid_campaigns")
      .update({ active: false })
      .eq("active", true)
      .neq("id", values.id || "00000000-0000-0000-0000-000000000000");
    if (deactivateError) throw deactivateError;
  }

  if (values.id) {
    const { data, error } = await supabase
      .from("tabloid_campaigns")
      .update(payload)
      .eq("id", values.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("tabloid_campaigns")
    .insert({ ...payload, created_by: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}
