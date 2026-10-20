/**
 * QA de impressão dos eventos do Painel de Gestão.
 * - Requer Vite local na porta 5183 e sessão autenticada por login manual
 *   (ou QA_STORAGE_STATE externo ao repositório).
 * - Inspeciona a altura efetiva das barras de comparação sob media=print.
 * - Exporta PDFs e capturas de impressão em qa-output/event-print/ (ignorado).
 * - NÃO modifica nem envia dados do Supabase.
 */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = (process.env.QA_BASE_URL || "http://127.0.0.1:5183").replace(/\/$/, "");
const sessionFile = process.env.QA_STORAGE_STATE;
const out = path.resolve(__dirname, "../qa-output/event-print");

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function safeFileName(name) {
  return String(name || "evento").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 55) || "evento";
}

async function main() {
  if (sessionFile) assert(fs.existsSync(sessionFile), "QA_STORAGE_STATE não encontrado.");
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: Boolean(sessionFile) });
  const result = { status: "FAIL", checkedAt: new Date().toISOString(), events: [], errors: [] };
  try {
    const context = await browser.newContext({
      ...(sessionFile ? { storageState: sessionFile } : {}),
      viewport: { width: 1366, height: 900 },
      locale: "pt-BR",
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => result.errors.push(error.message));
    await page.goto(`${baseUrl}/#/eventos`, { waitUntil: "domcontentloaded" });
    if (!sessionFile) process.stdout.write("Entre no Painel de Gestão para auditar a impressão de Eventos.\n");

    await page.locator(".page-events .event-bar-columns").first()
      .waitFor({ state: "visible", timeout: sessionFile ? 30000 : 180000 });

    // Percorre os eventos navegáveis, sem presumir quais foram sincronizados.
    const visited = new Set();
    for (let i = 0; i < 8; i++) {
      await page.emulateMedia({ media: "screen" });
      const title = (await page.locator(".page-events .event-hero h1").textContent() || "").trim();
      if (!title || visited.has(title)) break;
      visited.add(title);

      await page.evaluate(() => document.fonts.ready);
      await page.emulateMedia({ media: "print" });
      const metrics = await page.evaluate(() => {
        const chart = document.querySelector(".page-events .event-vertical-chart");
        const columns = document.querySelector(".page-events .event-bar-columns");
        const nodes = [...document.querySelectorAll(".page-events .event-bar-columns i")];
        const mm = 96 / 25.4;
        return {
          chartHeightMm: chart ? chart.getBoundingClientRect().height / mm : 0,
          columnsHeightMm: columns ? columns.getBoundingClientRect().height / mm : 0,
          count: nodes.length,
          tallestBarMm: Math.max(0, ...nodes.map(n => n.getBoundingClientRect().height / mm)),
          tallestBarRatio: Math.max(0, ...nodes.map(n => {
            const parent = n.parentElement?.getBoundingClientRect().height || 1;
            return n.getBoundingClientRect().height / parent;
          })),
          barColors: nodes.slice(0, 2).map(n => getComputedStyle(n).backgroundColor),
          hasHeader: [...document.querySelectorAll(".page-events .print-report-header")].some(
            el => getComputedStyle(el).display !== "none"
          ),
        };
      });
      assert(metrics.count >= 2, `${title}: sem barras renderizadas`);
      assert(metrics.hasHeader, `${title}: cabeçalho de impressão não visível`);
      assert(metrics.columnsHeightMm >= 35, `${title}: altura das colunas menor que 35mm`);
      assert(metrics.tallestBarMm >= 29, `${title}: barras achatadas (${metrics.tallestBarMm.toFixed(1)}mm)`);
      assert(metrics.tallestBarRatio >= 0.75, `${title}: maior barra não preenche o eixo vertical`);

      const filename = safeFileName(title);
      await page.screenshot({
        path: path.join(out, `${filename}-print.png`),
        fullPage: true,
        animations: "disabled",
      });
      await page.pdf({
        path: path.join(out, `${filename}-a4.pdf`),
        preferCSSPageSize: true,
        printBackground: true,
      });
      result.events.push({ title, status: "PASS", ...metrics });
      await page.emulateMedia({ media: "screen" });

      const next = page.locator(".page-events .event-hero-nav-button.next");
      if (!await next.count() || await next.isDisabled()) break;
      await next.click();
      await page.waitForFunction(
        previous => {
          const text = document.querySelector(".page-events .event-hero h1")?.textContent?.trim();
          return Boolean(text && text !== previous);
        },
        title,
        { timeout: 10000 },
      );
      await page.locator(".page-events .event-bar-columns").first().waitFor();
    }
    assert(result.events.length >= 1, "Nenhum evento disponível para validar.");
    assert(result.errors.length === 0, `Erro JavaScript: ${result.errors.join("; ")}`);
    result.status = "PASS";
    process.stdout.write(`QA impressão Eventos: PASS (${result.events.length} eventos; gráficos com altura correta)\n`);
  } catch (error) {
    result.errors.push(error.message);
    throw error;
  } finally {
    fs.writeFileSync(path.join(out, "result.json"), JSON.stringify(result, null, 2));
    await browser.close();
  }
}

main().catch(error => {
  console.error("QA impressão Eventos: FAIL —", error.message);
  process.exitCode = 1;
});
