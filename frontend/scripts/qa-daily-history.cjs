// Auditoria visual e funcional da Venda Diária com Playwright.
// Requer uma sessão autenticada exportada LOCALMENTE em QA_STORAGE_STATE.
// Não salve o estado autenticado nem credenciais no repositório.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = (process.env.QA_BASE_URL || 'http://127.0.0.1:5183').replace(/\/$/, '');
const sessionFile = process.env.QA_STORAGE_STATE;
const browserPath = process.env.QA_CHROMIUM_PATH || undefined;
const outDir = path.resolve(__dirname, '../qa-output/daily-history');
const widths = [1440, 1366, 768, 390, 360];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function brDate(iso) {
  return iso.split('-').reverse().join('/');
}

async function run() {
  assert(sessionFile && fs.existsSync(sessionFile),
    'Defina QA_STORAGE_STATE com o caminho de um arquivo Playwright storageState autenticado, mantido FORA do Git.');
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    ...(browserPath ? { executablePath: browserPath } : {}),
  });
  const errors = [];
  const results = [];
  try {
    const context = await browser.newContext({
      storageState: sessionFile,
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      locale: 'pt-BR',
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${baseUrl}/#/diaria`, { waitUntil: 'domcontentloaded' });
    await page.locator('#daily-sales-date').waitFor({ timeout: 20000 });

    // Verifica presença do histórico e pelo menos um dia real sincronizado.
    await page.waitForFunction(() => {
      const select = document.getElementById('daily-sales-date');
      return select && select.options.length > 1;
    }, null, { timeout: 20000 });
    const dates = await page.locator('#daily-sales-date option').evaluateAll(
      (nodes) => nodes.map((node) => node.value).filter((value) => value !== 'latest')
    );
    assert(dates.length > 0, 'Nenhum dia sincronizado para testar.');
    assert(dates.every((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)), 'Formato inválido no seletor.');
    assert(dates.every((date, i) => i === 0 || dates[i - 1] >= date),
      'Datas fora de ordem decrescente.');

    // Selecionar uma data antiga deve trocar o período real exibido.
    const historicalDate = dates[dates.length - 1];
    await page.locator('#daily-sales-date').selectOption(historicalDate);
    await page.waitForFunction((expected) => {
      const period = document.querySelector('.compact-report-periods strong')?.textContent || '';
      return period.includes(expected);
    }, brDate(historicalDate), { timeout: 20000 });
    await page.locator('.table-carousel-slide.active .hierarchy-row').first().waitFor({ timeout: 20000 });
    results.push({ test: 'consulta_histórica', status: 'PASS', date: historicalDate });

    // Confere responsividade, screenshot e estouro horizontal da página.
    for (const width of widths) {
      await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
      await page.screenshot({ path: path.join(outDir, `daily-${width}.png`), fullPage: true });
      const dimensions = await page.evaluate(() => ({
        viewport: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        selectHeight: document.getElementById('daily-sales-date')?.getBoundingClientRect().height || 0,
      }));
      assert(dimensions.documentWidth <= dimensions.viewport + 1,
        `Overflow horizontal em ${width}px: ${dimensions.documentWidth}px`);
      assert(dimensions.selectHeight >= 44,
        `Seletor abaixo de 44px em ${width}px: ${dimensions.selectHeight}px`);
      results.push({ test: 'layout_responsivo', width, status: 'PASS', ...dimensions });
    }

    // O formulário precisa ser operável pelo teclado e o foco deve ser visível.
    const dateControl = page.locator('#daily-sales-date');
    await dateControl.focus();
    assert(await dateControl.evaluate((node) => node.matches(':focus-visible')),
      'O seletor não apresenta foco de teclado visível.');
    results.push({ test: 'acessibilidade_teclado', status: 'PASS' });

    // O seletor não deve ser impresso; o cabeçalho do relatório deve permanecer.
    await page.emulateMedia({ media: 'print' });
    const printVisibility = await page.evaluate(() => ({
      filterHidden: getComputedStyle(document.querySelector('.daily-history-toolbar')).display === 'none',
      reportVisible: [...document.querySelectorAll('.print-report-header')].some(
        (node) => getComputedStyle(node).display !== 'none'
      ),
    }));
    assert(printVisibility.filterHidden, 'Filtro de datas aparece na impressão.');
    assert(printVisibility.reportVisible, 'Cabeçalho do relatório não aparece na impressão.');
    results.push({ test: 'impressao', status: 'PASS' });
    await page.emulateMedia({ media: 'screen' });

    // Retorno ao snapshot atual.
    await dateControl.selectOption('latest');
    await page.waitForFunction(
      () => document.getElementById('daily-sales-date')?.value === 'latest'
        && Boolean(document.querySelector('.compact-report-periods strong')),
      null, { timeout: 20000 }
    );
    results.push({ test: 'voltar_mais_recente', status: 'PASS' });
    assert(errors.length === 0, `Erros JavaScript: ${errors.join('; ')}`);
    fs.writeFileSync(path.join(outDir, 'result.json'),
      JSON.stringify({ status: 'PASS', datesAvailable: dates.length, results, errors }, null, 2));
    process.stdout.write(`QA Venda Diária: PASS (${dates.length} datas; ${widths.length} resoluções)\n`);
  } catch (error) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'result.json'),
      JSON.stringify({ status: 'FAIL', error: error.message, results, errors }, null, 2));
    throw error;
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error('QA Venda Diária: FAIL —', error.message);
  process.exitCode = 1;
});
