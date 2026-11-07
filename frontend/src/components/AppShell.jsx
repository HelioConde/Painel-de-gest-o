import {
  BarChart3,
  Bot,
  CalendarDays,
  ChevronLeft,
  ChevronDown,
  Download,
  FileText,
  LogOut,
  Layers3,
  Menu,
  Settings,
  ShoppingCart,
  Star,
  TrendingDown,
  TrendingUp,
  Activity,
  ClipboardCheck,
  History,
  Radar,
  ChartPie,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import primorLogoWide from "../assets/primor-logo-wide.png";
import primorLogoSquare from "../assets/primor-logo-square.png";
import { useAuth } from "../auth/AuthProvider";
import "../styles/new-features.css";
import "../styles/sidebar-groups.css";
import { groupForPath, groupVisibleNavigation } from "../utils/navigationSections.js";

const NAV = [
  {
    to: "/eventos",
    label: "Eventos",
    initial: "E",
    tone: "events",
    icon: CalendarDays,
    permission: "eventos",
  },
  {
    to: "/diaria",
    label: "Venda Diária",
    initial: "D",
    tone: "daily",
    icon: TrendingUp,
    permission: "vendaDiaria",
  },
  {
    to: "/mensal",
    label: "Venda Mensal",
    initial: "M",
    tone: "monthly",
    icon: BarChart3,
    permission: "vendaMensal",
  },
  {
    to: "/tabloide",
    label: "Tabloide",
    isNew: false,
    initial: "T",
    tone: "monthly",
    icon: ShoppingCart,
    permission: "tabloide",
  },
  {
    to: "/perdas",
    label: "Perdas",
    initial: "P",
    tone: "losses",
    icon: TrendingDown,
    permission: "perdas",
  },
  {
    to: "/comparativo",
    label: "Comparativo de Lojas",
    isNew: true,
    initial: "L",
    tone: "monthly",
    icon: Layers3,
    permission: "comparativoLojas",
  },
  {
    to: "/radar",
    label: "Radar das Lojas",
    initial: "R",
    tone: "monthly",
    icon: Radar,
    permission: "radarOportunidades",
    isNew: true,
  },
  {
    to: "/diagnostico-vendas",
    label: "Diagnóstico de Vendas",
    initial: "D",
    tone: "daily",
    icon: BarChart3,
    permission: "diagnosticoVendas",
    isNew: true,
  },
  {
    to: "/pareto-perdas",
    label: "Curva ABC / Pareto",
    initial: "A",
    tone: "losses",
    icon: ChartPie,
    permission: "paretoPerdas",
    isNew: true,
  },
  {
    to: "/saude-dados",
    label: "Saúde dos Dados",
    initial: "S",
    tone: "settings",
    icon: Activity,
    permission: "saudeDados",
    isNew: true,
  },
  {
    to: "/planos-acao",
    label: "Planos de Ação",
    initial: "A",
    tone: "settings",
    icon: ClipboardCheck,
    permission: "planosAcao",
    isNew: true,
  },
  {
    to: "/historico-produtos",
    label: "Histórico de Produtos",
    initial: "H",
    tone: "losses",
    icon: History,
    permission: "historicoProdutos",
    isNew: true,
  },
  {
    to: "/analise-ia",
    label: "Análise com IA",
    initial: "IA",
    tone: "ai",
    icon: Bot,
    permission: "aiAccess",
  },
  {
    to: "/cartazes",
    label: "Cartazes",
    initial: "C",
    tone: "posters",
    icon: FileText,
    permission: "cartazes",
  },
  {
    to: "/configuracoes",
    label: "Configurações",
    initial: "C",
    tone: "settings",
    icon: Settings,
    permission: "configuracoes",
  },
];


function SidebarNavItem({ item, onNavigate, nested = false }) {
  const { to, label, initial, tone, icon: Icon } = item;
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        ["nav-item", "nav-" + tone, nested ? "nav-subitem" : "", isActive ? "active" : ""]
          .filter(Boolean).join(" ")
      }
      title={label}
      aria-label={label}
    >
      <span className={"nav-initial nav-initial-" + tone} aria-hidden="true">{initial}</span>
      <Icon className="nav-icon" size={18} aria-hidden="true" />
      <span className="nav-label">{label}</span>
    </NavLink>
  );
}

export function isMonthlyCloseWindow(today = new Date()) {
  const day = today.getDate();
  return day >= 1 && day <= 7;
}

const INSTALL_DISMISS_KEY = "primor-pwa-install-dismissed-at";
const INSTALL_DISMISS_DAYS = 7;

function isStandaloneMode() {
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true
  );
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function installDismissedRecently() {
  const raw = window.localStorage.getItem(INSTALL_DISMISS_KEY);
  if (!raw) return false;
  const dismissedAt = Number(raw);
  if (!Number.isFinite(dismissedAt)) return false;
  const age = Date.now() - dismissedAt;
  return age < INSTALL_DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

export default function AppShell({ children }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [installAvailable, setInstallAvailable] = useState(false);
  const [installBannerOpen, setInstallBannerOpen] = useState(false);
  const [iosInstallHelp, setIosInstallHelp] = useState(false);
  const installPromptRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState(() => ({
    intelligence: groupForPath(location.pathname) === "intelligence",
    management: groupForPath(location.pathname) === "management",
  }));
  const { profile, hasPermission, signOut } = useAuth();
  const visibleNavigation = NAV.filter((item) =>
    hasPermission(item.permission),
  );
  const navigation =
    isMonthlyCloseWindow() && hasPermission("fechamentoMensal")
      ? [
          ...visibleNavigation.slice(0, 3),
          {
            to: "/fechamento-mensal",
            label: "Fechamento Mensal",
            initial: "F",
            tone: "monthly",
            icon: Star,
            permission: "fechamentoMensal",
          },
          ...visibleNavigation.slice(3),
        ]
      : visibleNavigation;

  const sections = groupVisibleNavigation(navigation);
  const currentGroup = groupForPath(location.pathname);
  useEffect(() => {
    if (currentGroup === "reports") return;
    setExpandedSections((current) =>
      current[currentGroup] ? current : { ...current, [currentGroup]: true }
    );
  }, [currentGroup]);

  function toggleSection(key) {
    if (collapsed) {
      setCollapsed(false);
      setExpandedSections((current) => ({ ...current, [key]: true }));
      return;
    }
    setExpandedSections((current) => ({ ...current, [key]: !current[key] }));
  }

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  useEffect(() => {
    if (isStandaloneMode()) return undefined;

    const ios = isIosDevice();
    let showTimer;

    const maybeShowBanner = () => {
      if (installDismissedRecently()) return;
      window.clearTimeout(showTimer);
      showTimer = window.setTimeout(() => setInstallBannerOpen(true), 1400);
    };

    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      installPromptRef.current = event;
      setInstallAvailable(true);
      setIosInstallHelp(false);
      maybeShowBanner();
    }

    function handleInstalled() {
      installPromptRef.current = null;
      setInstallAvailable(false);
      setInstallBannerOpen(false);
      setIosInstallHelp(false);
      window.localStorage.removeItem(INSTALL_DISMISS_KEY);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    if (ios && !installDismissedRecently()) {
      setIosInstallHelp(true);
      maybeShowBanner();
    }

    return () => {
      window.clearTimeout(showTimer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function handleInstallApp() {
    const promptEvent = installPromptRef.current;

    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice?.outcome === "accepted") {
          setInstallBannerOpen(false);
          setInstallAvailable(false);
          installPromptRef.current = null;
          return;
        }
      } catch {
        // Mantém a aplicação funcional se o navegador recusar o prompt.
      }

      window.localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()));
      setInstallBannerOpen(false);
      return;
    }

    if (iosInstallHelp) {
      setInstallBannerOpen(true);
    }
  }

  function dismissInstallBanner() {
    window.localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()));
    setInstallBannerOpen(false);
  }

  return (
    <div className={`app-shell ${collapsed ? "sidebar-is-collapsed" : ""}`}>
      <aside
        className={`sidebar ${open ? "sidebar-open" : ""} ${collapsed ? "sidebar-collapsed" : ""}`}
      >
        <div className="brand">
          <div className="brand-expanded">
            <img
              className="brand-logo-wide"
              src={primorLogoWide}
              alt="Primor supermercado"
            />
            <div className="brand-copy">
              <strong>Painel de Gestão</strong>
              <span>Desempenho comercial</span>
            </div>
          </div>

          <div className="brand-collapsed" aria-hidden={!collapsed}>
            <img src={primorLogoSquare} alt="Primor supermercado" />
          </div>

          <button
            className="sidebar-close"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            type="button"
          >
            <X size={20} />
          </button>
        </div>


        <nav className="nav-list" aria-label="Navegação principal">
          {sections.reports.length ? (
            <div className="nav-section nav-section-reports">
              <span className="nav-section-title">RELATÓRIOS</span>
              {sections.reports.map((item) => (
                <SidebarNavItem key={item.to} item={item} onNavigate={() => setOpen(false)} />
              ))}
            </div>
          ) : null}
          {[
            { key: "intelligence", label: "Inteligência", icon: Layers3 },
            { key: "management", label: "Gestão", icon: ClipboardCheck },
          ].filter((group) => sections[group.key].length).map((group) => {
            const Icon = group.icon;
            const expanded = Boolean(expandedSections[group.key]);
            const active = group.key === currentGroup;
            return (
              <div className="nav-section nav-section-group" key={group.key}>
                <button
                  type="button"
                  className={"nav-group-toggle" + (active ? " active" : "")}
                  onClick={() => toggleSection(group.key)}
                  aria-expanded={expanded}
                  aria-controls={"nav-group-" + group.key}
                  aria-label={group.label + (expanded ? " — recolher" : " — expandir")}
                  title={group.label}
                >
                  <Icon className="nav-group-icon" size={18} aria-hidden="true" />
                  <span className="nav-group-label">{group.label}</span>
                  {sections[group.key].some((item) => item.isNew) ?
                    <span className="feature-new-badge nav-group-new" aria-hidden="true">NOVO</span> : null}
                  <ChevronDown className={"nav-group-chevron" + (expanded ? " open" : "")} size={15} aria-hidden="true" />
                </button>
                <div
                  id={"nav-group-" + group.key}
                  className="nav-subitems"
                  hidden={!expanded}
                >
                  {sections[group.key].map((item) => (
                    <SidebarNavItem key={item.to} item={item} nested onNavigate={() => setOpen(false)} />
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="sidebar-user-panel">
          <UserRound size={16} aria-hidden="true" />
          <span>{profile?.display_name || "Usuário"}</span>
          <button
            type="button"
            onClick={handleSignOut}
            aria-label="Sair do painel"
            title="Sair"
          >
            <LogOut size={15} />
          </button>
        </div>
        {(installAvailable || iosInstallHelp) && !isStandaloneMode() ? (
          <button
            type="button"
            className="sidebar-install-app"
            onClick={handleInstallApp}
            title={collapsed ? "Instalar aplicativo" : undefined}
          >
            <Download size={16} aria-hidden="true" />
            <span>Instalar aplicativo</span>
          </button>
        ) : null}

        <div className="sidebar-footer">
          <span className="status-dot" />
          <span className="sidebar-status-text">
            Desenvolvido por Hélio Conde
          </span>
        </div>
      </aside>

      {/* Fora da sidebar: overflow: hidden não pode recortar a seta. */}
      <button
        className="sidebar-toggle desktop-only"
        onClick={() => setCollapsed((current) => !current)}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
        title={collapsed ? "Expandir menu" : "Recolher menu"}
        type="button"
      >
        <ChevronLeft size={18} aria-hidden="true" />
      </button>

      {open && (
        <button
          className="sidebar-backdrop"
          onClick={() => setOpen(false)}
          aria-label="Fechar menu"
        />
      )}

      <main className="main-area">
        <div className="mobile-topbar">
          <button
            className="icon-button"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
            type="button"
          >
            <Menu size={20} />
          </button>
          <img
            className="mobile-topbar-logo"
            src={primorLogoWide}
            alt="Primor supermercado"
          />
          <span>Painel de Gestão</span>
        </div>
        {children}
      </main>

      {installBannerOpen && !isStandaloneMode() ? (
        <section className="pwa-install-banner" aria-live="polite" aria-label="Instalar Painel de Gestão">
          <div className="pwa-install-icon" aria-hidden="true">
            <Download size={22} />
          </div>
          <div className="pwa-install-copy">
            <strong>Instale o Painel de Gestão</strong>
            <span>
              {iosInstallHelp && !installAvailable
                ? "No iPhone/iPad, use Compartilhar e depois Adicionar à Tela de Início."
                : "Acesse vendas, eventos, perdas e tabloides direto pela tela inicial."}
            </span>
          </div>
          <div className="pwa-install-actions">
            <button type="button" className="pwa-install-later" onClick={dismissInstallBanner}>
              Agora não
            </button>
            {installAvailable ? (
              <button type="button" className="pwa-install-primary" onClick={handleInstallApp}>
                Instalar
              </button>
            ) : (
              <button type="button" className="pwa-install-primary" onClick={dismissInstallBanner}>
                Entendi
              </button>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
