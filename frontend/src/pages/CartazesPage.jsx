import { ChevronLeft, ChevronRight, ClipboardPaste, History, LayoutGrid, Plus, Printer, RotateCcw, Settings, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import PosterPreview from '../components/posters/PosterPreview'
import PosterPrintDialog from '../components/posters/PosterPrintDialog'
import PosterSheet from '../components/posters/PosterSheet'
import {
  getPageCount,
  getPosterFormat,
  POSTER_FORMAT_OPTIONS,
} from '../config/posterFormats'
import { getDefaultTemplateForFormat, getPosterTemplatesForFormat } from '../config/posterTemplates'
import { countProductLines, parseProducts } from '../utils/posterParser'
import { deletePosterJob, listPosterJobs, savePosterJob } from '../utils/posterHistoryStorage'
import { loadPosterTemplate } from '../utils/posterTemplateStorage'

const PRINT_STYLE_ID = 'poster-dynamic-page'
const FIELD_COLUMNS = [
  ['description', 'Descrição'],
  ['subdescription', 'Subdescrição'],
  ['complement', 'Complemento'],
  ['unit', 'Gramatura'],
  ['price', 'Venda'],
]

function splitIntoPages(products, perPage) {
  if (!products.length) return [[]]
  return Array.from({ length: Math.ceil(products.length / perPage) }, (_, index) => (
    products.slice(index * perPage, (index + 1) * perPage)
  ))
}

function applyPosterPrintPage(format) {
  let style = document.getElementById(PRINT_STYLE_ID)
  if (!style) {
    style = document.createElement('style')
    style.id = PRINT_STYLE_ID
    document.head.appendChild(style)
  }
  style.textContent = `@page { size: ${format.paper} ${format.orientation}; margin: 0; }`
  document.body.classList.add('poster-printing')
}

function clearPosterPrintPage() {
  document.getElementById(PRINT_STYLE_ID)?.remove()
  document.body.classList.remove('poster-printing')
}

export default function CartazesPage() {
  const [sourceText, setSourceText] = useState('')
  const [productData, setProductData] = useState([])
  const [formatId, setFormatId] = useState('A4_4X1')
  const [templateId, setTemplateId] = useState(() => getDefaultTemplateForFormat('A4_4X1').id)
  const [templateConfig, setTemplateConfig] = useState(() => loadPosterTemplate(getDefaultTemplateForFormat('A4_4X1').id))
  const [currentPage, setCurrentPage] = useState(0)
  const [printDialogOpen, setPrintDialogOpen] = useState(false)
  const [printConfig, setPrintConfig] = useState({ invertSecondPoster: false, copies: 1 })
  const [activeSection, setActiveSection] = useState('create')
  const [historyItems, setHistoryItems] = useState(() => listPosterJobs())
  const [currentJobId, setCurrentJobId] = useState(null)
  const [selectedProductId, setSelectedProductId] = useState(null)
  const [checkedProductIds, setCheckedProductIds] = useState([])
  const [fontAvailable, setFontAvailable] = useState(null)

  const formatConfig = getPosterFormat(formatId)
  const formatTemplates = useMemo(() => getPosterTemplatesForFormat(formatId), [formatId])
  const inputCount = countProductLines(sourceText)
  const pages = useMemo(
    () => splitIntoPages(productData, formatConfig.postersPerSheet),
    [formatConfig.postersPerSheet, productData],
  )
  const pageCount = getPageCount(productData.length, formatConfig)
  const pageProducts = pages[currentPage] || pages[0]
  const firstPoster = productData.length ? currentPage * formatConfig.postersPerSheet + 1 : 0
  const lastPoster = productData.length
    ? Math.min(productData.length, firstPoster + pageProducts.length - 1)
    : 0

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, pageCount - 1))
  }, [pageCount])

  useEffect(() => {
    setTemplateConfig(loadPosterTemplate(templateId))
  }, [templateId])

  useEffect(() => {
    const refreshTemplate = () => setTemplateConfig(loadPosterTemplate(templateId))
    window.addEventListener('focus', refreshTemplate)
    return () => window.removeEventListener('focus', refreshTemplate)
  }, [templateId])

  useEffect(() => {
    if (!formatConfig.supportsInvertSecond && printConfig.invertSecondPoster) {
      setPrintConfig((current) => ({ ...current, invertSecondPoster: false }))
    }
  }, [formatConfig.supportsInvertSecond, printConfig.invertSecondPoster])

  useEffect(() => {
    let active = true
    document.fonts.load('16px "Burbank Big Cd Bk"').then(() => {
      if (active) setFontAvailable(document.fonts.check('16px "Burbank Big Cd Bk"'))
    }).catch(() => {
      if (active) setFontAvailable(false)
    })
    return () => { active = false }
  }, [])

  const persistCurrentJob = useCallback((products = productData, forcedId = currentJobId) => {
    if (!products.length) return null
    const saved = savePosterJob({
      id: forcedId,
      sourceText,
      formatId,
      templateId,
      productCount: products.length,
      pageCount: getPageCount(products.length, getPosterFormat(formatId)),
      products,
      invertSecondPoster: printConfig.invertSecondPoster,
    })
    setCurrentJobId(saved.id)
    setHistoryItems(listPosterJobs())
    return saved
  }, [currentJobId, formatId, printConfig.invertSecondPoster, productData, sourceText, templateId])

  useEffect(() => {
    if (!currentJobId || !productData.length) return undefined
    const timer = window.setTimeout(() => persistCurrentJob(), 350)
    return () => window.clearTimeout(timer)
  }, [currentJobId, formatId, persistCurrentJob, printConfig.invertSecondPoster, productData, templateId])

  const generatePosters = () => {
    const products = parseProducts(sourceText)
    setProductData(products)
    setCurrentPage(0)
    setSelectedProductId(products[0]?.id || null)
    setCheckedProductIds([])
    persistCurrentJob(products)
  }

  const updateProduct = (id, field, value) => {
    const normalized = field === 'price' ? value : value.toLocaleUpperCase('pt-BR')
    setProductData((products) => products.map((product) => (
      product.id === id ? { ...product, [field]: normalized } : product
    )))
  }

  const selectProduct = (id) => {
    const index = productData.findIndex((product) => product.id === id)
    if (index < 0) return
    setSelectedProductId(id)
    setCurrentPage(Math.floor(index / formatConfig.postersPerSheet))
    window.requestAnimationFrame(() => document.querySelector(`tr[data-product-id="${id}"]`)?.scrollIntoView({ block: 'nearest' }))
  }

  const goToPage = (nextPage) => {
    const bounded = Math.max(0, Math.min(pageCount - 1, nextPage))
    setCurrentPage(bounded)
    setSelectedProductId(productData[bounded * formatConfig.postersPerSheet]?.id || null)
  }

  const toggleCheckedProduct = (id) => setCheckedProductIds((current) => (
    current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
  ))

  const deleteSelectedProducts = () => {
    const selected = new Set(checkedProductIds)
    const remaining = productData.filter((product) => !selected.has(product.id))
    setProductData(remaining)
    setCheckedProductIds([])
    setSelectedProductId(remaining[0]?.id || null)
    setCurrentPage(0)
  }

  const startNewJob = () => {
    persistCurrentJob()
    setSourceText('')
    setProductData([])
    setCurrentJobId(null)
    setSelectedProductId(null)
    setCheckedProductIds([])
    setCurrentPage(0)
    setActiveSection('create')
  }

  const openHistoryJob = (job) => {
    const cloned = savePosterJob({ ...job, id: undefined, createdAt: undefined, updatedAt: undefined })
    setSourceText(job.sourceText || '')
    setProductData(job.products || [])
    setFormatId(job.formatId)
    setTemplateId(job.templateId || getDefaultTemplateForFormat(job.formatId).id)
    setPrintConfig((current) => ({ ...current, invertSecondPoster: Boolean(job.invertSecondPoster) }))
    setCurrentJobId(cloned.id)
    setCurrentPage(0)
    setSelectedProductId(job.products?.[0]?.id || null)
    setCheckedProductIds([])
    setHistoryItems(listPosterJobs())
    setActiveSection('create')
  }

  const removeHistoryJob = (id) => {
    deletePosterJob(id)
    setHistoryItems(listPosterJobs())
  }

  const closePrintDialog = useCallback(() => setPrintDialogOpen(false), [])
  const updatePrintConfig = (change) => setPrintConfig((current) => ({ ...current, ...change }))

  const printPosters = (confirmedConfig) => {
    if (fontAvailable === false) return
    setPrintConfig(confirmedConfig)
    closePrintDialog()
    applyPosterPrintPage(formatConfig)
    const cleanup = () => {
      clearPosterPrintPage()
      window.removeEventListener('afterprint', cleanup)
    }
    window.addEventListener('afterprint', cleanup)
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()))
    window.setTimeout(cleanup, 2000)
  }

  return (
    <div className="page page-cartazes page-view-enter">
      <div className="poster-screen">
        <header className="poster-page-header">
          <div>
            <span className="poster-page-kicker">Comunicação de ofertas</span>
            <h1>Cartaz Rápido</h1>
            <p>Crie, confira e imprima placas promocionais.</p>
          </div>
          <div className="poster-header-stat">
            <strong>{productData.length}</strong>
            <span>{productData.length === 1 ? 'cartaz pronto' : 'cartazes prontos'}</span>
          </div>
        </header>

        <nav className="poster-module-nav" aria-label="Cartaz Rápido">
          <button type="button" className={activeSection === 'create' ? 'active' : ''} onClick={() => setActiveSection('create')}><LayoutGrid size={16} /> Criar cartaz</button>
          <button type="button" onClick={startNewJob}><Plus size={16} /> Novo</button>
          <button type="button" className={activeSection === 'history' ? 'active' : ''} onClick={() => { setHistoryItems(listPosterJobs()); setActiveSection('history') }}><History size={16} /> Histórico</button>
          <button type="button" className={activeSection === 'settings' ? 'active' : ''} onClick={() => setActiveSection('settings')}><Settings size={16} /> Configurações</button>
          <span>{formatConfig.label}</span>
        </nav>

        {fontAvailable === false ? <div className="poster-font-error" role="alert">Fonte Burbank Big Cd Bk não encontrada.</div> : null}

        {activeSection === 'create' ? <div className="poster-workspace">
          <main className="poster-editor-column">
            <section className="poster-panel poster-input-panel">
              <div className="poster-panel-heading">
                <div>
                  <span className="poster-section-kicker"><ClipboardPaste size={14} /> Entrada</span>
                  <h2>Cole seus produtos</h2>
                </div>
                <div className="poster-config-selects">
                  <label className="poster-format-select">
                    <span>Formato</span>
                    <select value={formatId} onChange={(event) => {
                      const nextFormat = event.target.value
                      setFormatId(nextFormat)
                      setTemplateId(getDefaultTemplateForFormat(nextFormat).id)
                      setCurrentPage(0)
                    }}>
                      {POSTER_FORMAT_OPTIONS.map((format) => (
                        <option value={format.id} key={format.id}>{format.label} · {format.postersPerSheet} por folha</option>
                      ))}
                    </select>
                  </label>
                  <label className="poster-format-select">
                    <span>Template</span>
                    <select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
                      {formatTemplates.map((template) => <option value={template.id} key={template.id}>{template.name}</option>)}
                    </select>
                  </label>
                </div>
              </div>

              <label className="poster-textarea-field">
                <span>Uma linha por produto</span>
                <textarea
                  value={sourceText}
                  onChange={(event) => setSourceText(event.target.value)}
                  placeholder={'Pão Francês kg 10,90\nCerveja Heineken Long Neck 300ml 5,99\nCoca Cola Zero 2L 9,99'}
                  rows={7}
                  onKeyDown={(event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && inputCount) generatePosters()
                  }}
                />
              </label>

              <div className="poster-input-footer">
                <div className="poster-input-meta">
                  <button type="button" className="poster-icon-button" aria-label="Adicionar linha" onClick={() => setSourceText((current) => `${current}${current && !current.endsWith('\n') ? '\n' : ''}`)}><Plus size={17} /></button>
                  <span><strong>{inputCount}</strong> {inputCount === 1 ? 'produto identificado' : 'produtos identificados'} · Ctrl+Enter</span>
                </div>
                <button type="button" className="poster-button poster-button-primary" onClick={generatePosters} disabled={!inputCount}>
                  <LayoutGrid size={17} /> {productData.length ? 'Atualizar cartazes' : 'Gerar cartazes'}
                </button>
              </div>
            </section>

            <section className="poster-panel poster-products-panel">
              <div className="poster-panel-heading poster-table-heading">
                <div>
                  <span className="poster-section-kicker">Conteúdo interpretado</span>
                  <h2>Lista de placas</h2>
                </div>
                <div className="poster-table-actions">
                  {checkedProductIds.length ? <button type="button" className="poster-button poster-button-danger" onClick={deleteSelectedProducts}><Trash2 size={15} /> Excluir {checkedProductIds.length}</button> : null}
                  <span className="poster-product-badge">{productData.length}</span>
                </div>
              </div>

              {productData.length ? (
                <div className="poster-table-wrap">
                  <table className="poster-product-table">
                    <thead><tr><th className="poster-select-column"><span className="sr-only">Selecionar</span></th>{FIELD_COLUMNS.map(([, label]) => <th key={label}>{label}</th>)}</tr></thead>
                    <tbody>
                      {productData.map((product) => (
                        <tr key={product.id} data-product-id={product.id} className={selectedProductId === product.id ? 'selected' : ''} onClick={() => selectProduct(product.id)}>
                          <td className="poster-select-column" data-label="Selecionar">
                            <input type="checkbox" aria-label={`Selecionar ${product.description || 'produto'}`} checked={checkedProductIds.includes(product.id)} onClick={(event) => event.stopPropagation()} onChange={() => toggleCheckedProduct(product.id)} />
                          </td>
                          {FIELD_COLUMNS.map(([field, label]) => (
                            <td key={field} data-label={label}>
                              <input
                                aria-label={`${label} de ${product.description || 'produto'}`}
                                value={product[field]}
                                onFocus={() => selectProduct(product.id)}
                                onChange={(event) => updateProduct(product.id, field, event.target.value)}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="poster-empty-table">
                  <ClipboardPaste size={22} />
                  <strong>Nenhum produto gerado</strong>
                  <span>Cole uma linha por produto e gere os cartazes.</span>
                </div>
              )}
            </section>
          </main>

          <aside className="poster-preview-column">
            <section className="poster-panel poster-preview-panel">
              <div className="poster-preview-heading">
                <div>
                  <span className="poster-section-kicker">Pré-visualização</span>
                  <h2>Folha {currentPage + 1} de {pageCount}</h2>
                </div>
                <span>{firstPoster === lastPoster ? `${firstPoster} / ${productData.length}` : `${firstPoster}–${lastPoster} / ${productData.length}`}</span>
              </div>

              <PosterPreview
                format={formatConfig}
                products={pageProducts}
                template={templateConfig}
                invertSecondPoster={printConfig.invertSecondPoster}
                startIndex={currentPage * formatConfig.postersPerSheet}
                selectedProductId={selectedProductId}
                onSelectProduct={selectProduct}
              />

              <div className="poster-preview-nav">
                <button type="button" className="poster-icon-button" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 0} aria-label="Folha anterior"><ChevronLeft size={18} /></button>
                <span><strong>{currentPage + 1}</strong> / {pageCount}</span>
                <button type="button" className="poster-icon-button" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= pageCount - 1} aria-label="Próxima folha"><ChevronRight size={18} /></button>
              </div>

              {formatConfig.supportsInvertSecond ? (
                <label className="poster-toggle-row">
                  <input
                    type="checkbox"
                    checked={printConfig.invertSecondPoster}
                    onChange={(event) => updatePrintConfig({ invertSecondPoster: event.target.checked })}
                  />
                  <span>Inverter 2ª placa</span>
                </label>
              ) : null}

              <button type="button" className="poster-button poster-button-primary poster-print-action" onClick={() => setPrintDialogOpen(true)} disabled={!productData.length || fontAvailable === false}>
                <Printer size={17} /> Imprimir
              </button>
            </section>
          </aside>
        </div> : null}

        {activeSection === 'history' ? (
          <section className="poster-panel poster-history-panel">
            <div className="poster-panel-heading">
              <div><span className="poster-section-kicker"><History size={14} /> Trabalhos salvos</span><h2>Histórico</h2></div>
              <span className="poster-product-badge">{historyItems.length}</span>
            </div>
            {historyItems.length ? <div className="poster-history-list">
              {historyItems.map((job) => (
                <article key={job.id}>
                  <button type="button" className="poster-history-open" onClick={() => openHistoryJob(job)}>
                    <strong>{job.products?.[0]?.description || 'Cartazes'}</strong>
                    <span>{new Date(job.updatedAt).toLocaleString('pt-BR')} · {getPosterFormat(job.formatId).label}</span>
                    <small>{job.productCount} cartazes · {job.pageCount} folhas</small>
                  </button>
                  <button type="button" className="poster-icon-button" aria-label={`Excluir ${job.products?.[0]?.description || 'trabalho'}`} onClick={() => removeHistoryJob(job.id)}><Trash2 size={17} /></button>
                </article>
              ))}
            </div> : <div className="poster-empty-table"><History size={22} /><strong>Nenhum trabalho salvo</strong><span>Os trabalhos aparecem aqui depois de gerar ou atualizar placas.</span></div>}
          </section>
        ) : null}

        {activeSection === 'settings' ? (
          <section className="poster-panel poster-settings-panel">
            <div className="poster-panel-heading"><div><span className="poster-section-kicker"><Settings size={14} /> Saída</span><h2>Configurações</h2></div></div>
            <div className="poster-settings-grid">
              <div><span>Fonte das placas</span><strong>Burbank Big Cd Bk</strong><small>{fontAvailable === false ? 'Não encontrada' : 'Disponível'}</small></div>
              <div><span>Papel atual</span><strong>{formatConfig.paper}</strong><small>{formatConfig.orientation === 'portrait' ? 'Retrato' : 'Paisagem'}</small></div>
              <div><span>Modo de impressão</span><strong>Somente frente</strong><small>Simplex; frente e verso desativado</small></div>
              <div><span>Propriedades</span><strong>Diálogo do sistema</strong><small>A impressora e a bandeja são escolhidas ao imprimir.</small></div>
            </div>
            <a href="#/cartazes/admin-layout" className="poster-button poster-button-secondary poster-settings-admin"><RotateCcw size={16} /> Ajustar templates</a>
          </section>
        ) : null}
      </div>

      <div className="poster-print-root" aria-hidden="true">
        {Array.from({ length: printConfig.copies }, (_, copyIndex) => pages.map((products, pageIndex) => (
          <PosterSheet
            key={`${copyIndex}-${pageIndex}`}
            className="poster-print-sheet"
            format={formatConfig}
            products={products}
            template={templateConfig}
            invertSecondPoster={printConfig.invertSecondPoster}
            showGuide={false}
          />
        )))}
      </div>

      <PosterPrintDialog
        open={printDialogOpen}
        format={formatConfig}
        productCount={productData.length}
        pageCount={pageCount}
        printConfig={printConfig}
        onClose={closePrintDialog}
        onPrint={printPosters}
      />
    </div>
  )
}
