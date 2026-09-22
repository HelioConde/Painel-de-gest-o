import { ChevronLeft, ChevronRight, ClipboardPaste, History, LayoutGrid, Maximize2, Pencil, Printer, Settings, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PosterInputActionsMenu from '../components/posters/PosterInputActionsMenu'
import PosterPreview from '../components/posters/PosterPreview'
import PosterPrintDialog from '../components/posters/PosterPrintDialog'
import PosterFormatPickerModal from '../components/posters/PosterFormatPickerModal'
import PosterSheet from '../components/posters/PosterSheet'
import {
  getPageCount,
  getPosterFormat,
  POSTER_FORMAT_OPTIONS,
} from '../config/posterFormats'
import { getDefaultTemplateForFormat } from '../config/posterTemplates'
import { countProductLines, parseProducts } from '../utils/posterParser'
import { deletePosterJob, listPosterJobs, savePosterJob } from '../utils/posterHistoryStorage'
import { loadPosterTemplate } from '../utils/posterTemplateStorage'
import { createPosterLayouts } from '../poster-engine/layoutPlan'
import { createBrowserTextMeasure } from '../utils/posterBrowserMeasure'

const PRINT_STYLE_ID = 'poster-dynamic-page'
const FIELD_COLUMNS = [
  ['description', 'Descrição'],
  ['subdescription', 'Subdescrição'],
  ['complement', 'Complemento'],
  ['unit', 'Gramatura'],
  ['price', 'Venda'],
]
const APP_FIELD_COLUMNS = [
  ['description', 'Descrição'],
  ['subdescription', 'Subdescrição'],
  ['complement', 'Complemento'],
  ['unit', 'Gramatura'],
  ['price', 'Preço App'],
  ['validity', 'Validade'],
  ['regularPrice', 'Preço fora do App'],
]
const EXAMPLE_PRODUCTS = 'Cerveja Heineken Long Neck 300ml 5,99\nPão Francês kg 10,90\nPão de queijo kg 20,90'

function normalizeImportedPrice(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value.toFixed(2).replace('.', ',')
  return String(value || '').trim().replace(/^R\$\s*/i, '').replace(/^(\d+)\.(\d{2})$/, '$1,$2')
}

function isHeaderRow(values) {
  const text = values.join(' ').toLocaleLowerCase('pt-BR')
  return /descri[cç][aã]o|produto|pre[cç]o|venda|gramatura|unidade/.test(text)
}

function spreadsheetRowsToSource(rows) {
  const contentRows = rows
    .map((row) => row.filter((value) => String(value ?? '').trim()))
    .filter((row) => row.length)
  const dataRows = isHeaderRow((contentRows[0] || []).map((value) => String(value).trim())) ? contentRows.slice(1) : contentRows

  return dataRows.map((row) => {
    if (row.length === 1) return String(row[0]).trim()
    const values = row.map((value) => String(value ?? '').trim())
    values[values.length - 1] = normalizeImportedPrice(row.at(-1))
    return values.join(' ')
  }).join('\n')
}

function splitIntoPages(products, perPage) {
  if (!products.length) return [[]]
  return Array.from({ length: Math.ceil(products.length / perPage) }, (_, index) => (
    products.slice(index * perPage, (index + 1) * perPage)
  ))
}

function productDisplayName(product) {
  return [product?.description, product?.subdescription, product?.complement, product?.unit].filter(Boolean).join(' ') || 'Cartazes'
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
  const navigate = useNavigate()
  const [sourceText, setSourceText] = useState('')
  const sourceTextareaRef = useRef(null)
  const generalFileInputRef = useRef(null)
  const excelFileInputRef = useRef(null)
  const [productData, setProductData] = useState([])
  const [formatId, setFormatId] = useState(null)
  const [templateId, setTemplateId] = useState(null)
  const [templateConfig, setTemplateConfig] = useState(() => loadPosterTemplate(getDefaultTemplateForFormat('A4X4').id))
  const [currentPage, setCurrentPage] = useState(0)
  const [printDialogOpen, setPrintDialogOpen] = useState(false)
  const [printConfig, setPrintConfig] = useState({ copies: 1 })
  const [activeSection, setActiveSection] = useState('create')
  const [historyItems, setHistoryItems] = useState(() => listPosterJobs())
  const [currentJobId, setCurrentJobId] = useState(null)
  const [selectedProductId, setSelectedProductId] = useState(null)
  const [checkedProductIds, setCheckedProductIds] = useState([])
  const [fontAvailable, setFontAvailable] = useState(null)
  const [formatPickerOpen, setFormatPickerOpen] = useState(true)
  const [inputActionsOpen, setInputActionsOpen] = useState(false)
  const [importError, setImportError] = useState('')
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [printOnlyCurrentPage, setPrintOnlyCurrentPage] = useState(false)

  const hasFormat = Boolean(formatId)
  const formatConfig = getPosterFormat(formatId)
  const posterTextMeasure = useMemo(() => createBrowserTextMeasure(), [fontAvailable])
  const layoutPlans = useMemo(
    () => createPosterLayouts(productData, templateConfig, formatConfig, posterTextMeasure),
    [formatConfig, posterTextMeasure, productData, templateConfig],
  )
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
    if (!templateId) return
    setTemplateConfig(loadPosterTemplate(templateId))
  }, [templateId])

  useEffect(() => {
    if (!templateId) return undefined
    const refreshTemplate = () => setTemplateConfig(loadPosterTemplate(templateId))
    window.addEventListener('focus', refreshTemplate)
    return () => window.removeEventListener('focus', refreshTemplate)
  }, [templateId])

  useEffect(() => {
    let active = true
    document.fonts.load('16px "Burbank Big Cd Bk"').then(() => {
      if (active) setFontAvailable(document.fonts.check('16px "Burbank Big Cd Bk"'))
    }).catch(() => {
      if (active) setFontAvailable(false)
    })
    return () => { active = false }
  }, [])

  const persistCurrentJob = useCallback((products = productData, forcedId = currentJobId, jobSource = sourceText) => {
    if (!products.length) return null
    const saved = savePosterJob({
      id: forcedId,
      sourceText: jobSource,
      formatId,
      templateId,
      productCount: products.length,
      pageCount: getPageCount(products.length, getPosterFormat(formatId)),
      products,
    })
    setCurrentJobId(saved.id)
    setHistoryItems(listPosterJobs())
    return saved
  }, [currentJobId, formatId, productData, sourceText, templateId])

  useEffect(() => {
    if (!currentJobId || !productData.length) return undefined
    const timer = window.setTimeout(() => persistCurrentJob(), 350)
    return () => window.clearTimeout(timer)
  }, [currentJobId, formatId, persistCurrentJob, productData, templateId])

  const applyProductSource = (nextSource) => {
    if (!hasFormat) { setFormatPickerOpen(true); return }
    const appTemplate = getDefaultTemplateForFormat('A4X2_APP')
    const products = parseProducts(nextSource).map((product) => formatId === 'A4X2_APP' ? ({
      ...product,
      validity: appTemplate.appValidityText.replace(/^OFERTA VÁLIDA ATÉ\s*/i, ''),
      regularLabel: appTemplate.appRegularLabel,
      regularPrice: '',
    }) : product)
    setSourceText(nextSource)
    setProductData(products)
    setCurrentPage(0)
    setSelectedProductId(products[0]?.id || null)
    setCheckedProductIds([])
    persistCurrentJob(products, currentJobId, nextSource)
  }

  const generatePosters = () => applyProductSource(sourceText)

  const clearProductList = () => {
    setSourceText('')
    setProductData([])
    setCurrentJobId(null)
    setSelectedProductId(null)
    setCheckedProductIds([])
    setCurrentPage(0)
    setImportError('')
    window.requestAnimationFrame(() => sourceTextareaRef.current?.focus())
  }

  const importProductFile = async (file) => {
    if (!file) return
    setImportError('')
    try {
      const extension = file.name.split('.').pop()?.toLocaleLowerCase('pt-BR')
      let importedSource = ''
      if (extension === 'txt') {
        importedSource = await file.text()
      } else if (extension === 'csv' || extension === 'xls' || extension === 'xlsx') {
        const XLSX = await import('@e965/xlsx')
        const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        importedSource = spreadsheetRowsToSource(XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: true, defval: '' }))
      } else {
        throw new Error('Formato não suportado.')
      }
      if (!importedSource.trim()) throw new Error('O arquivo não possui produtos para importar.')
      applyProductSource(importedSource)
      window.requestAnimationFrame(() => sourceTextareaRef.current?.focus())
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Não foi possível importar o arquivo.')
    }
  }

  const handleInputAction = (action) => {
    if (action === 'file') generalFileInputRef.current?.click()
    if (action === 'excel') excelFileInputRef.current?.click()
    if (action === 'example') applyProductSource(EXAMPLE_PRODUCTS)
    if (action === 'clear') clearProductList()
  }

  const updateProduct = (id, field, value) => {
    const normalized = ['price', 'regularPrice'].includes(field) ? value : value.toLocaleUpperCase('pt-BR')
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

  const startNewPosterJob = () => {
    persistCurrentJob()
    setSourceText('')
    setProductData([])
    setCurrentJobId(null)
    setSelectedProductId(null)
    setCheckedProductIds([])
    setCurrentPage(0)
    setActiveSection('create')
    setFormatId(null)
    setTemplateId(null)
    setFormatPickerOpen(true)
    window.requestAnimationFrame(() => sourceTextareaRef.current?.focus())
  }

  const openHistoryJob = (job) => {
    const cloned = savePosterJob({ ...job, id: undefined, createdAt: undefined, updatedAt: undefined })
    setSourceText(job.sourceText || '')
    setProductData(job.products || [])
    const historyFormat = getPosterFormat(job.formatId)
    setFormatId(historyFormat.id)
    setTemplateId(getDefaultTemplateForFormat(historyFormat.id).id)
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
  const closeFormatPicker = () => setFormatPickerOpen(false)
  const selectFormat = (nextFormat) => {
    setFormatId(nextFormat)
    setTemplateId(getDefaultTemplateForFormat(nextFormat).id)
    setCurrentPage(0)
    if (nextFormat === 'A4X2_APP') {
      const appTemplate = getDefaultTemplateForFormat('A4X2_APP')
      setProductData((products) => products.map((product) => ({
        ...product,
        validity: product.validity || appTemplate.appValidityText.replace(/^OFERTA VÁLIDA ATÉ\s*/i, ''),
        regularLabel: product.regularLabel || appTemplate.appRegularLabel,
        regularPrice: product.regularPrice || '',
      })))
    }
    setFormatPickerOpen(false)
  }

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

  const printCurrentSheet = () => {
    setPrintOnlyCurrentPage(true)
    printPosters({ copies: 1 })
    window.setTimeout(() => setPrintOnlyCurrentPage(false), 2200)
  }

  const editPreviewProduct = () => {
    setPreviewDialogOpen(false)
    if (selectedProductId) selectProduct(selectedProductId)
    window.requestAnimationFrame(() => document.querySelector('.poster-products-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
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
          <button type="button" className={activeSection === 'create' ? 'active' : ''} onClick={startNewPosterJob}><LayoutGrid size={16} /> Novo cartaz</button>
          <button type="button" className={activeSection === 'history' ? 'active' : ''} onClick={() => { setHistoryItems(listPosterJobs()); setActiveSection('history') }}><History size={16} /> Histórico</button>
          <button type="button" onClick={() => navigate('/cartazes/admin-layout')}><Settings size={16} /> Configurações</button>
          <button type="button" className="poster-format-chip" onClick={() => setFormatPickerOpen(true)}>{hasFormat ? formatConfig.label : 'Escolher formato'} <span>· Alterar formato</span></button>
        </nav>

        {fontAvailable === false ? <div className="poster-font-error" role="alert">Fonte Burbank Big Cd Bk não encontrada.</div> : null}

        {activeSection === 'create' ? <div className="poster-workspace">
          <main className="poster-editor-column">
            <section className="poster-panel poster-input-panel">
              <div className="poster-panel-heading">
                <div>
                  <h2>Cole seus produtos</h2>
                </div>
              </div>

              <label className="poster-textarea-field">
                <span className="poster-input-subtitle">Uma linha por produto</span>
                <textarea
                  ref={sourceTextareaRef}
                  value={sourceText}
                  onChange={(event) => setSourceText(event.target.value)}
                  placeholder={'Pão Francês kg 10,90\nCerveja Heineken Long Neck 300ml 5,99\nCoca Cola Zero 2L 9,99'}
                  rows={7}
                  onKeyDown={(event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && inputCount) generatePosters()
                  }}
                />
              </label>
              <input ref={generalFileInputRef} className="poster-visually-hidden" type="file" accept=".txt,.csv,.xls,.xlsx,text/plain,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { importProductFile(event.target.files?.[0]); event.target.value = '' }} />
              <input ref={excelFileInputRef} className="poster-visually-hidden" type="file" accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { importProductFile(event.target.files?.[0]); event.target.value = '' }} />
              {importError ? <p className="poster-import-error" role="alert">{importError}</p> : null}

              <div className="poster-input-footer">
                <div className="poster-input-meta">
                  <PosterInputActionsMenu open={inputActionsOpen} onOpenChange={setInputActionsOpen} onAction={handleInputAction} />
                  <span><strong>{inputCount}</strong> {inputCount === 1 ? 'produto identificado' : 'produtos identificados'} · Ctrl+Enter</span>
                </div>
                <button type="button" className="poster-button poster-button-primary" onClick={generatePosters} disabled={!inputCount || !hasFormat}>
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
                  <table className={`poster-product-table ${formatId === 'A4X2_APP' ? 'poster-product-table-app' : ''}`}>
                    <thead><tr><th className="poster-select-column"><span className="sr-only">Selecionar</span></th>{(formatId === 'A4X2_APP' ? APP_FIELD_COLUMNS : FIELD_COLUMNS).map(([, label]) => <th key={label}>{label}</th>)}</tr></thead>
                    <tbody>
                      {productData.map((product) => (
                        <tr key={product.id} data-product-id={product.id} className={selectedProductId === product.id ? 'selected' : ''} onClick={() => selectProduct(product.id)}>
                          <td className="poster-select-column" data-label="Selecionar">
                            <input type="checkbox" aria-label={`Selecionar ${product.description || 'produto'}`} checked={checkedProductIds.includes(product.id)} onClick={(event) => event.stopPropagation()} onChange={() => toggleCheckedProduct(product.id)} />
                          </td>
                          {(formatId === 'A4X2_APP' ? APP_FIELD_COLUMNS : FIELD_COLUMNS).map(([field, label]) => (
                            <td key={field} data-label={label}>
                              <input
                                aria-label={`${label} de ${product.description || 'produto'}`}
                                value={product[field] || ''}
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
                layoutPlans={layoutPlans}
                showBackground
                startIndex={currentPage * formatConfig.postersPerSheet}
                selectedProductId={selectedProductId}
                onSelectProduct={selectProduct}
                onOpen={() => productData.length && setPreviewDialogOpen(true)}
              />
              {productData.length ? <button type="button" className="poster-preview-open" onClick={() => setPreviewDialogOpen(true)}><Maximize2 size={15} /> Ampliar placa</button> : null}

              <div className="poster-preview-nav">
                <button type="button" className="poster-icon-button" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 0} aria-label="Folha anterior"><ChevronLeft size={18} /></button>
                <span><strong>{currentPage + 1}</strong> / {pageCount}</span>
                <button type="button" className="poster-icon-button" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= pageCount - 1} aria-label="Próxima folha"><ChevronRight size={18} /></button>
              </div>

              {formatConfig.invertedSlots.length ? <p className="poster-format-note">A placa superior já sai invertida neste formato.</p> : null}

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
                    <strong>{productDisplayName(job.products?.[0])}</strong>
                    <span>{new Date(job.updatedAt).toLocaleString('pt-BR')} · {getPosterFormat(job.formatId).label}</span>
                    <small>{job.productCount} cartazes · {job.pageCount} folhas</small>
                  </button>
                  <button type="button" className="poster-icon-button" aria-label={`Excluir ${productDisplayName(job.products?.[0])}`} onClick={() => removeHistoryJob(job.id)}><Trash2 size={17} /></button>
                </article>
              ))}
            </div> : <div className="poster-empty-table"><History size={22} /><strong>Nenhum trabalho salvo</strong><span>Os trabalhos aparecem aqui depois de gerar ou atualizar placas.</span></div>}
          </section>
        ) : null}

      </div>

      <div className="poster-print-root" aria-hidden="true">
        {Array.from({ length: printConfig.copies }, (_, copyIndex) => (printOnlyCurrentPage ? [pageProducts] : pages).map((products, pageIndex) => (
          <PosterSheet
            key={`${copyIndex}-${pageIndex}`}
            className="poster-print-sheet"
            format={formatConfig}
            products={products}
            template={templateConfig}
            layoutPlans={layoutPlans}
            showBackground={formatConfig.specialLayout === 'app-offer'}
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
      <PosterFormatPickerModal
        open={formatPickerOpen}
        currentFormatId={formatId}
        formats={POSTER_FORMAT_OPTIONS}
        onClose={closeFormatPicker}
        onSelect={selectFormat}
        required={!hasFormat}
      />
      {previewDialogOpen ? <div className="poster-modal-backdrop poster-preview-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setPreviewDialogOpen(false)}>
        <section className="poster-modal poster-preview-dialog" role="dialog" aria-modal="true" aria-label="Visualização ampliada da folha">
          <header><div><span className="poster-modal-kicker">Visualização · {formatConfig.label}</span><h2>{productDisplayName(pageProducts[0])}</h2></div><button type="button" className="poster-icon-button" onClick={() => setPreviewDialogOpen(false)} aria-label="Fechar visualização"><X size={18} /></button></header>
          <div className="poster-preview-dialog-canvas"><PosterPreview fitViewport format={formatConfig} products={pageProducts} template={templateConfig} layoutPlans={layoutPlans} showBackground startIndex={currentPage * formatConfig.postersPerSheet} selectedProductId={selectedProductId} onSelectProduct={selectProduct} /></div>
          <div className="poster-preview-nav"><button type="button" className="poster-icon-button" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 0} aria-label="Folha anterior"><ChevronLeft size={18} /></button><span><strong>{currentPage + 1}</strong> / {pageCount}</span><button type="button" className="poster-icon-button" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= pageCount - 1} aria-label="Próxima folha"><ChevronRight size={18} /></button></div>
          <footer><button type="button" className="poster-button poster-button-secondary" onClick={editPreviewProduct}><Pencil size={16} /> Editar</button><button type="button" className="poster-button poster-button-secondary" onClick={printCurrentSheet}><Printer size={16} /> Imprimir esta folha</button><button type="button" className="poster-button poster-button-primary" onClick={printCurrentSheet}><Printer size={16} /> Imprimir / Salvar PDF</button></footer>
        </section>
      </div> : null}
    </div>
  )
}
