import { supabase, supabaseConfigured } from "../lib/supabase";

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
  const { data: campaign, error } = await supabase
    .from("tabloid_campaigns")
    .select("*")
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  if (!campaign) return { campaign: null, snapshot: null, products: [] };

  // Durante o período do tabloide, sempre mantemos visível o último
  // resultado válido já coletado. A tela não fica vazia apenas porque
  // a coleta do dia atual ainda não terminou.
  const now = new Date();
  const localToday = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  const validUntil =
    localToday < campaign.end_date ? localToday : campaign.end_date;

  const { data: snapshot, error: snapshotError } = await supabase
    .from("tabloid_snapshots")
    .select("*")
    .eq("campaign_id", campaign.id)
    .gte("reference_date", campaign.start_date)
    .lte("reference_date", validUntil)
    .order("reference_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (snapshotError) throw snapshotError;
  if (!snapshot)
    return {
      campaign,
      snapshot: null,
      products: [],
      availableThrough: null,
      awaitingUpdate: true,
    };

  const { data: products, error: productsError } = await supabase
    .from("tabloid_product_sales")
    .select("*")
    .eq("snapshot_id", snapshot.id)
    .order("sales_value", { ascending: false });
  if (productsError) throw productsError;

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
  const { data: snapshots, error: snapshotsError } = await supabase
    .from("tabloid_snapshots")
    .select("*")
    .in("campaign_id", ids)
    .order("imported_at", { ascending: false });
  if (snapshotsError) throw snapshotsError;
  const snapshotsByCampaign = new Map();
  for (const snapshot of snapshots || []) {
    if (!snapshotsByCampaign.has(snapshot.campaign_id))
      snapshotsByCampaign.set(snapshot.campaign_id, snapshot);
  }
  return { campaigns: campaigns || [], snapshotsByCampaign };
}

export async function saveTabloidCampaign(values, userId) {
  configured();
  const payload = {
    name: tabloidCampaignName(values.start_date, values.end_date),
    start_date: values.start_date,
    end_date: values.end_date,
    promotion_type: 1,
    promotion_name: "TABLOIDE",
    active: Boolean(values.active),
  };
  if (payload.active) {
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
