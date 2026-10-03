import {
  BarChart3,
  Bot,
  CalendarDays,
  ChevronLeft,
  Download,
  FileText,
  LogOut,
  Menu,
  Settings,
  ShoppingCart,
  Star,
  TrendingDown,
  TrendingUp,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import primorLogoWide from "../assets/primor-logo-wide.png";
import primorLogoSquare from "../assets/primor-logo-square.png";
import { useAuth } from "../auth/AuthProvider";

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
    initial: "T",
    tone: "monthly",
    icon: ShoppingCart,
    isNew: true,
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
    to: "/analise-ia",
    label: "Análise com IA",
    initial: "IA",
    tone: "ai",
    icon: Bot,
    isNew: true,
    permission: "aiAccess",
  },
  {
    to: "/cartazes",
    label: "Cartazes",
    initial: "C",
    tone: "posters",
    icon: FileText,
    isNew: true,
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
            isNew: true,
            permission: "fechamentoMensal",
          },
          ...visibleNavigation.slice(3),
        ]
      : visibleNavigation;

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
            className="sidebar-toggle desktop-only"
            onClick={() => setCollapsed((current) => !current)}
            aria-label={
              collapsed ? "Expandir barra lateral" : "Recolher barra lateral"
            }
            type="button"
          >
            <ChevronLeft size={18} />
          </button>

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
          {navigation.map(
            ({ to, label, initial, tone, icon: Icon, isNew = false }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `nav-item nav-${tone} ${isActive ? "active" : ""}`
                }
                title={
                  collapsed
                    ? isNew
                      ? `${label}: nova funcionalidade`
                      : label
                    : undefined
                }
                aria-label={isNew ? `${label}, nova funcionalidade` : label}
              >
                <span
                  className={`nav-initial nav-initial-${tone}`}
                  aria-hidden="true"
                >
                  {initial}
                </span>
                <Icon className="nav-icon" size={18} />
                <span className="nav-label">{label}</span>
                {isNew ? (
                  <span
                    className="nav-new-badge"
                    title="Nova ferramenta para criação e impressão de cartazes"
                    aria-hidden="true"
                  >
                    Novo
                  </span>
                ) : null}
              </NavLink>
            ),
          )}
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
