// Regressão visual: quatro relatórios em 360, 390, 768 e 1366 CSS px.
// Use login manual; não salve sessão ou dados comerciais no Git.
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = (process.env.QA_BASE_URL || "http://127.0.0.1:5183").replace(/\/$/, "");
const sessionFile = process.env.QA_STORAGE_STATE;
const outDir = path.resolve(__dirname, "../qa-output/report-mobile");
const widths = [1366, 768, 390, 360];
const routes = [
  { slug: "diaria", ready: ".table-carousel-slide.active .sector-row" },
  { slug: "mensal", ready: ".table-carousel-slide.active .sector-row" },
  { slug: "eventos", ready: ".event-performance-card" },
  { slug: "perdas", ready: ".loss-summary-panel" },
];

function check(condition, message) {
  if (!condition) throw Error(message);
}

async function main() {
  if (sessionFile) check(fs.existsSync(sessionFile), "Arquivo QA_STORAGE_STATE não encontrado.");
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: Boolean(sessionFile) });
  const summary = { status: "FAIL", errors: [], results: [] };
  try {
    const context = await browser.newContext({
      ...(sessionFile ? { storageState: sessionFile } : {}),
      viewport: { width: 1366, height: 900 },
      locale: "pt-BR",
    });
    const page = await context.newPage();
    page.on("pageerror", error => summary.errors.push(error.message));
    for (const route of routes) {
      await page.goto(`${baseUrl}/#/${route.slug}`, { waitUntil: "domcontentloaded" });
      if (route.slug === "diaria" && !sessionFile) {
        process.stdout.write("Faça login na janela aberta para executar o QA visual.\n");
      }
      await page.locator(route.ready).first().waitFor({
        state: "visible",
        timeout: sessionFile ? 30000 : 180000,
      });

      for (const width of widths) {
        await page.setViewportSize({ width, height: width < 500 ? 850 : 900 });
        // Espera fontes e transição responsiva antes de fotografar.
        // Sem isso, a sidebar de desktop aparece parcialmente sobre a página
        // na captura de 768px mesmo estando fechada após a animação.
        await page.evaluate(async () => { await document.fonts.ready; });
        if (width <= 820) {
          await page.waitForFunction(() => {
            const sidebar = document.querySelector(".app-shell > .sidebar");
            if (!sidebar || sidebar.classList.contains("sidebar-open")) return false;
            return sidebar.getBoundingClientRect().right <= 1;
          }, null, { timeout: 5000 });
        }
        await page.screenshot({
          path: path.join(outDir, `${route.slug}-${width}.png`),
          fullPage: true,
          animations: "disabled",
          caret: "hide",
        });
        // Uma segunda imagem captura a tela visível sem a composição de
        // uma página muito longa, útil para conferir artefatos do Chromium.
        await page.screenshot({
          path: path.join(outDir, `${route.slug}-${width}-viewport.png`),
          animations: "disabled",
          caret: "hide",
        });
        const metrics = await page.evaluate((name) => {
          const bounds = element => element?.getBoundingClientRect();
          const isMobile = innerWidth <= 420;
          const clipped = [];
          if (name === "diaria" || name === "mensal") {
            const rows = document.querySelectorAll(".table-carousel-slide.active .sector-row");
            for (const row of rows) {
              const rect = bounds(row);
              const sector = row.querySelector(".hierarchy-name strong")?.textContent?.trim();
              for (const node of row.querySelectorAll(".hierarchy-values > *, .hierarchy-values .status-badge")) {
                const box = bounds(node);
                if (box && (box.right > rect.right + 1 || box.left < rect.left - 1)) {
                  clipped.push({ sector, text: node.textContent.trim() });
                }
              }
            }
          }

          let visual = null;
          if (name === "diaria" || name === "mensal") {
            const grid = document.querySelector(".table-carousel-slide.active .sector-row .hierarchy-values");
            visual = grid ? {
              columns: getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length,
              badgeVisible: !!grid.querySelector(".status-badge"),
              textFontPx: Number.parseFloat(getComputedStyle(grid.querySelector("strong")).fontSize),
            } : null;
          }
          const mobileCards = name === "eventos"
            ? document.querySelectorAll(".event-mobile-store-card").length
            : name === "perdas"
              ? document.querySelectorAll(".loss-mobile-sector-card").length
              : 0;
          const sidebar = document.querySelector(".app-shell > .sidebar");
          const sidebarOverlaps = innerWidth <= 820 &&
            Boolean(sidebar && sidebar.getBoundingClientRect().right > 1);
          // A distância entre linhas sucessivas não pode criar buracos na lista,
          // ainda que um screenshot fullPage apresente falhas de composição.
          const sectionGaps = [];
          if (name === "diaria" || name === "mensal") {
            const sections = [...document.querySelectorAll(
              ".table-carousel-slide.active .hierarchy-sector"
            )];
            for (let i = 1; i < sections.length; i++) {
              const gap = sections[i].getBoundingClientRect().top -
                sections[i - 1].getBoundingClientRect().bottom;
              if (gap > 36) sectionGaps.push({ position: i, gap: Math.round(gap) });
            }
          }
          return {
            sidebarOverlaps,
            sectionGaps,
            documentWidth: document.documentElement.scrollWidth,
            viewportWidth: document.documentElement.clientWidth,
            clipped,
            mobileCards,
            visual,
            isMobile,
          };
        }, route.slug);
        check(metrics.documentWidth <= metrics.viewportWidth + 1,
          `${route.slug} ${width}px: overflow da página (${metrics.documentWidth}px)`);
        check(metrics.clipped.length === 0,
          `${route.slug} ${width}px: valor cortado ${JSON.stringify(metrics.clipped)}`);
        check(!metrics.sidebarOverlaps,
          `${route.slug} ${width}px: barra lateral cobre relatório no celular/tablet`);
        check(metrics.sectionGaps.length === 0,
          `${route.slug} ${width}px: espaços excessivos entre setores ${JSON.stringify(metrics.sectionGaps)}`);
        if (width <= 420 && ["diaria", "mensal"].includes(route.slug)) {
          check(metrics.visual?.columns === 2,
            `${route.slug} ${width}px: esperado resumo numérico em duas colunas`);
          check(metrics.visual?.badgeVisible, "Badge de variação ausente.");
          check(metrics.visual?.textFontPx >= 11, "Números menores que 11px.");
        }
        if (width <= 390 && ["eventos", "perdas"].includes(route.slug)) {
          check(metrics.mobileCards > 0,
            `${route.slug} ${width}px: cartões móveis não foram renderizados`);
        }
        summary.results.push({ page: route.slug, width, status: "PASS", ...metrics });
      }

      // Teste o estado visual e semântico dos filtros sem alterar os dados.
      const filters = route.slug === "eventos" ? ".event-performance-controls button" :
        route.slug === "perdas" ? ".loss-summary-filters button" :
        ".table-carousel-slide.active .daily-sector-filters button";
      const choices = page.locator(filters);
      if (await choices.count() >= 2) {
        const next = choices.nth(1);
        await next.click();
        check(await next.getAttribute("aria-pressed") === "true",
          `${route.slug}: estado do filtro não comunicado com aria-pressed`);
        await choices.first().click();
      }
    }
    check(summary.errors.length === 0, `Erros JS: ${summary.errors.join("; ")}`);
    summary.status = "PASS";
    process.stdout.write(`QA Mobile: PASS (${summary.results.length} combinações)\n`);
  } catch (error) {
    summary.errors.push(error.message);
    throw error;
  } finally {
    fs.writeFileSync(path.join(outDir, "result.json"), JSON.stringify(summary, null, 2));
    await browser.close();
  }
}

main().catch(error => {
  console.error("QA Mobile: FAIL —", error.message);
  process.exitCode = 1;
});
