import '../styles/posters.css'
import { useEffect, useMemo, useState } from 'react'
import PosterPreview from '../components/posters/PosterPreview'
import { getPosterFormat } from '../config/posterFormats'
import { getDefaultTemplateForFormat } from '../config/posterTemplates'
import { createAppTitleLayouts } from '../poster-engine/appTitleLayout.js'
import { createPosterLayouts } from '../poster-engine/layoutPlan'
import { createBrowserTextMeasure } from '../utils/posterBrowserMeasure'

const LARGE_PAPER_SAMPLE = { id: 'cerveja-sra3-comparativo', description: 'CERVEJA', subdescription: 'HEINEKEN', complement: 'LONG NECK', unit: '300ML', price: '5,99' }

const APP_SAMPLE = { id: 'pao-forma-app', description: 'PAO DE FORMA', subdescription: 'GUARANY TRADICIONAL', unit: '450G', price: '3,99', regularPrice: '4,99', validity: '27/11/26' }
const SAMPLES = [
  { id: 'banana-nanica', description: 'BANANA', subdescription: 'NANICA', complement: '', unit: 'KG', price: '3,99' },
  { id: 'banana-prata', description: 'BANANA', subdescription: 'PRATA', complement: '', unit: 'KG', price: '4,99' },
  { id: 'abacaxi-peca', description: 'ABACAXI', subdescription: 'PEÇA', complement: '', unit: '', price: '6,99' },
  { id: 'mamao-formosa', description: 'MAMÃO', subdescription: 'FORMOSA', complement: '', unit: 'KG', price: '4,99' },
  { id: 'manga-palmer', description: 'MANGA', subdescription: 'PALMER', complement: '', unit: 'KG', price: '3,99' },
  { id: 'manga-tommy', description: 'MANGA', subdescription: 'TOMMY', complement: '', unit: 'KG', price: '4,99' },
]

export default function PosterVisualQaPage() {
  const [fontsReady, setFontsReady] = useState(false)
  const format = getPosterFormat('A4')
  const template = useMemo(() => getDefaultTemplateForFormat('A4'), [])
  const measure = useMemo(() => createBrowserTextMeasure(), [fontsReady])
  const layouts = useMemo(
    () => createPosterLayouts(SAMPLES, template, format, measure),
    [format, measure, template],
  )
  const largePaperComparisons = useMemo(() => ['A3', 'SRA3', 'A3_BLACK_FRIDAY', 'A3_APP', 'A4_APP', 'A4X2_APP'].map((formatId) => {
    const formatOption = getPosterFormat(formatId)
    const templateOption = getDefaultTemplateForFormat(formatId)
    const isApp = formatOption.specialLayout === 'app-offer'
    const product = isApp ? APP_SAMPLE : LARGE_PAPER_SAMPLE
    return {
      format: formatOption,
      template: templateOption,
      product,
      layouts: (isApp ? createAppTitleLayouts : createPosterLayouts)([product], templateOption, formatOption, measure),
    }
  }), [measure])

  useEffect(() => {
    let active = true
    Promise.all([
      document.fonts.load('16px "Burbank Big Cd Bk"'),
      document.fonts.load('16px "Futura Price"'),
    ]).finally(() => {
      if (active) setFontsReady(true)
    })
    return () => { active = false }
  }, [])

  return (
    <main className="poster-visual-qa" data-fonts-ready={fontsReady ? 'true' : 'false'}>
      <header className="poster-visual-qa-header">
        <span>QA visual · Cartazes</span>
        <h1>Referência de placas físicas</h1>
        <p>Captura automática para comparar tipografia, ocupação da descrição e tamanho do preço.</p>
      </header>

      <section className="poster-visual-qa-grid">
        {SAMPLES.map((product) => (
          <article className="poster-visual-qa-card" data-sample={product.id} key={product.id}>
            <div className="poster-visual-qa-label">
              <strong>{product.description} {product.subdescription}</strong>
              <span>{product.unit || 'PEÇA'} · R$ {product.price}</span>
            </div>
            <PosterPreview
              format={format}
              products={[product]}
              template={template}
              layoutPlans={layouts}
              showBackground
              fitViewport
            />
          </article>
        ))}
        {largePaperComparisons.map(({ format: largeFormat, template: largeTemplate, product, layouts: largeLayouts }) => (
          <article className="poster-visual-qa-card" data-sample={'cerveja-' + largeFormat.id.toLowerCase()} key={largeFormat.id}>
            <div className="poster-visual-qa-label">
              <strong>{largeFormat.label} · {product.description} {product.subdescription}</strong>
              <span>{largeFormat.widthMm} × {largeFormat.heightMm} mm · R$ {product.price}</span>
            </div>
            <PosterPreview
              format={largeFormat}
              products={[product]}
              template={largeTemplate}
              layoutPlans={largeLayouts}
              showBackground
              fitViewport
            />
          </article>
        ))}
      </section>
    </main>
  )
}
