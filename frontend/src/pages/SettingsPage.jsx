import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock3,
  Database,
  Eye,
  Plus,
  Save,
  Settings,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { ErrorState, LoadingState } from "../components/States";
import {
  getTabloidSettings,
  saveTabloidCampaign,
  tabloidCampaignName,
} from "../services/tabloid";

const empty = { name: "", start_date: "", end_date: "", active: true };
const date = (value) =>
  value
    ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${value}T12:00:00`))
    : "—";
const timestamp = (value) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";

function campaignStatus(campaign) {
  if (!campaign?.active) return "Inativa";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(`${campaign.start_date}T00:00:00`);
  const end = new Date(`${campaign.end_date}T23:59:59`);
  if (today < start) return "Agendada";
  if (today > end) return "Finalizada";
  return "Em andamento";
}

function StatusBadge({ status }) {
  const tone = status.toLocaleLowerCase("pt-BR").replaceAll(" ", "-");
  return (
    <span className={`settings-status settings-status-${tone}`}>{status}</span>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [form, setForm] = useState(empty);
  const [campaigns, setCampaigns] = useState([]);
  const [snapshotsByCampaign, setSnapshotsByCampaign] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState("");
  const [dateError, setDateError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await getTabloidSettings();
      setCampaigns(data.campaigns);
      setSnapshotsByCampaign(data.snapshotsByCampaign);
      const today = new Date();
      const todayKey = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, "0"),
        String(today.getDate()).padStart(2, "0"),
      ].join("-");
      const currentCampaign = [...data.campaigns]
        .filter(
          (campaign) =>
            campaign.start_date <= todayKey && campaign.end_date >= todayKey,
        )
        .sort(
          (a, b) =>
            b.start_date.localeCompare(a.start_date) ||
            new Date(b.updated_at) - new Date(a.updated_at),
        )[0];

      setForm(
        currentCampaign ||
          data.campaigns.find((campaign) => campaign.active) ||
          data.campaigns[0] ||
          empty,
      );
      setError(null);
    } catch (nextError) {
      setError(nextError);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const generatedName = useMemo(
    () => tabloidCampaignName(form.start_date, form.end_date),
    [form.start_date, form.end_date],
  );
  const selectedSnapshot = form.id ? snapshotsByCampaign.get(form.id) : null;
  const status = campaignStatus(form);
  const collectedUntil = selectedSnapshot?.period_end;
  const today = new Date();
  const todayValue = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const campaignEnd = form.end_date
    ? new Date(`${form.end_date}T12:00:00`)
    : null;
  const collectionEnd =
    campaignEnd && campaignEnd < todayValue
      ? form.end_date
      : todayValue.toISOString().slice(0, 10);
  const collectionRule =
    form.start_date && campaignEnd
      ? new Date(`${form.start_date}T12:00:00`) > todayValue
        ? "Aguardando o início da campanha"
        : `${date(form.start_date)} → ${date(collectionEnd)}`
      : "Defina o período da campanha";

  const change = (event) => {
    const value =
      event.target.type === "checkbox"
        ? event.target.checked
        : event.target.value;
    setForm((current) => ({ ...current, [event.target.name]: value }));
    setMessage("");
    if (event.target.name === "start_date" || event.target.name === "end_date")
      setDateError("");
  };
  const newCampaign = () => {
    setForm(empty);
    setDateError("");
    setMessage("");
  };
  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError(null);
    if (!form.start_date || !form.end_date) {
      setDateError("Informe a data inicial e a data final.");
      return;
    }
    if (form.end_date < form.start_date) {
      setDateError("A data final não pode ser anterior à data inicial.");
      return;
    }
    try {
      const saved = await saveTabloidCampaign(form, user?.id);
      const next = await getTabloidSettings();
      setCampaigns(next.campaigns);
      setSnapshotsByCampaign(next.snapshotsByCampaign);
      setForm(saved);
      setMessage(
        `Configuração salva. A próxima coleta usará ${date(saved.start_date)} → ${date(saved.end_date)} sem consultar datas futuras.`,
      );
    } catch (nextError) {
      setError(nextError);
    }
  };
  if (loading) return <LoadingState />;
  if (error && !campaigns.length)
    return <ErrorState error={error} onRetry={load} />;

  return (
    <div className="page settings-page page-tight">
      <header className="page-header dashboard-hero page-header-compact">
        <div className="page-header-copy dashboard-hero-copy">
          <span className="section-kicker">ADMINISTRAÇÃO</span>
          <h1>Configurações</h1>
          <p>Campanhas e acompanhamento operacional do tabloide.</p>
        </div>
        <Settings size={28} />
      </header>
      <div className="settings-layout">
        <section className="settings-card settings-campaign-card">
          <div className="settings-card-heading">
            <div>
              <span className="section-kicker">TABLOIDE</span>
              <h2>Configuração da campanha</h2>
              <p>
                O worker consulta do início configurado até a data atual, sem
                ultrapassar o fim da campanha.
              </p>
            </div>
            <button
              className="secondary-action"
              type="button"
              onClick={newCampaign}
            >
              <Plus size={16} /> Nova campanha
            </button>
          </div>
          <form onSubmit={submit} className="settings-form">
            <label className="settings-name">
              Nome da campanha
              <input
                readOnly
                name="name"
                value={generatedName}
                aria-label="Nome da campanha gerado automaticamente"
              />
            </label>
            <label>
              Data inicial
              <input
                required
                type="date"
                name="start_date"
                value={form.start_date || ""}
                onChange={change}
              />
            </label>
            <label>
              Data final
              <input
                required
                type="date"
                name="end_date"
                value={form.end_date || ""}
                onChange={change}
              />
            </label>
            <label className="settings-check">
              <input
                type="checkbox"
                name="active"
                checked={Boolean(form.active)}
                onChange={change}
              />{" "}
              Campanha ativa
            </label>
            <div className="settings-readonly">
              <span>Tipo de promoção</span>
              <strong>1 · TABLOIDE</strong>
            </div>
            {dateError ? (
              <p className="form-error settings-inline-error">
                <AlertTriangle size={15} /> {dateError}
              </p>
            ) : null}
            <button className="primary-action" type="submit">
              <Save size={16} /> Salvar configuração
            </button>
          </form>
          {message ? (
            <p className="form-success">
              <CheckCircle2 size={16} /> {message}
            </p>
          ) : null}
          {error ? (
            <p className="form-error">
              <AlertTriangle size={16} /> {error.message}
            </p>
          ) : null}
        </section>

        <section className="settings-card settings-collection-card">
          <div className="settings-card-heading">
            <div>
              <span className="section-kicker">OPERAÇÃO</span>
              <h2>Status da coleta</h2>
            </div>
            <Database size={22} />
          </div>
          <div className="settings-status-line">
            <span>Status da campanha</span>
            <StatusBadge status={status} />
          </div>
          <dl className="settings-collection-list">
            <div>
              <dt>Coleta automática</dt>
              <dd>
                <span className="settings-dot active" /> Ativa
              </dd>
            </div>
            <div>
              <dt>Última execução</dt>
              <dd>
                {selectedSnapshot
                  ? timestamp(selectedSnapshot.imported_at)
                  : "Sem execução registrada"}
              </dd>
            </div>
            <div>
              <dt>Último período coletado</dt>
              <dd>
                {selectedSnapshot
                  ? `${date(selectedSnapshot.period_start)} → ${date(selectedSnapshot.period_end)}`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Dados atualizados até</dt>
              <dd>{date(collectedUntil)}</dd>
            </div>
            <div>
              <dt>Próxima coleta</dt>
              <dd>Automática</dd>
            </div>
          </dl>
          <div className="settings-collection-rule">
            <Calendar size={16} />
            <span>
              {collectionRule}
              <small>Sem consultar datas futuras.</small>
            </span>
          </div>
        </section>
      </div>

      <section className="settings-card settings-history-card">
        <div className="settings-card-heading">
          <div>
            <span className="section-kicker">REGISTRO</span>
            <h2>Histórico de campanhas</h2>
            <p>Campanhas anteriores permanecem disponíveis para consulta.</p>
          </div>
          <Clock3 size={22} />
        </div>
        {!campaigns.length ? (
          <p className="settings-empty">Nenhuma campanha cadastrada.</p>
        ) : (
          <div className="settings-history-table">
            <div className="settings-history-head">
              <span>Campanha</span>
              <span>Período</span>
              <span>Status</span>
              <span>Última atualização</span>
              <span>Ações</span>
            </div>
            {campaigns.map((campaign) => (
              <div className="settings-history-row" key={campaign.id}>
                <strong>
                  {tabloidCampaignName(campaign.start_date, campaign.end_date)}
                </strong>
                <span data-label="Período">
                  {date(campaign.start_date)} → {date(campaign.end_date)}
                </span>
                <span data-label="Status">
                  <StatusBadge status={campaignStatus(campaign)} />
                </span>
                <span data-label="Última atualização">
                  {timestamp(snapshotsByCampaign.get(campaign.id)?.imported_at)}
                </span>
                <button
                  className="settings-view"
                  type="button"
                  onClick={() => {
                    setForm(campaign);
                    setMessage("");
                  }}
                >
                  <Eye size={15} /> Ver
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
