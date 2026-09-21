import { ArrowLeft, Copy, Image, RotateCcw, Save } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PosterAdminCanvas from '../components/posters/PosterAdminCanvas'
import { getPosterFormat, POSTER_FORMAT_OPTIONS } from '../config/posterFormats'
import { getDefaultTemplateForFormat, POSTER_TEMPLATES } from '../config/posterTemplates'
import { loadPosterTemplate, resetPosterTemplate, savePosterTemplate } from '../utils/posterTemplateStorage'

const TEST_PRODUCT_DEFAULT = {
  id: 'admin-preview',
  description: 'TESTE',
  subdescription: 'DE',
  complement: 'IMPRESSÃO',
  unit: '500G',
  price: '15,99',
}

const BOX_LABELS = { contentBox: 'Conteúdo', priceBox: 'Preço' }
const TEXT_LABELS = {
  description: 'Descrição',
  subdescription: 'Subdescrição',
  complement: 'Complemento',
  unit: 'Gramatura',
  price: 'Preço',
}

function NumberField({ label, value, onChange, min = 0, max = 100, step = 1 }) {
  return (
    <label className="poster-admin-number-field">
      <span>{label}</span>
      <input type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  )
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="poster-admin-select-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

export default function CartazesLayoutAdminPage() {
  const initialTemplate = getDefaultTemplateForFormat('A4X4')
  const [templateId, setTemplateId] = useState(initialTemplate.id)
  const [template, setTemplate] = useState(() => loadPosterTemplate(initialTemplate.id))
  const [testProduct, setTestProduct] = useState(TEST_PRODUCT_DEFAULT)
  const [selectedBox, setSelectedBox] = useState('contentBox')
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [snapStep, setSnapStep] = useState(1)
  const [duplicateFormat, setDuplicateFormat] = useState('A4')
  const [status, setStatus] = useState('')

  const format = getPosterFormat(template.format)
  const selected = template[selectedBox]
  const templatesByFormat = useMemo(() => POSTER_FORMAT_OPTIONS.map((formatOption) => ({
    ...formatOption,
    templates: POSTER_TEMPLATES.filter((item) => item.format === formatOption.id),
  })), [])

  useEffect(() => {
    if (duplicateFormat !== template.format) return
    const fallback = POSTER_FORMAT_OPTIONS.find((item) => item.id !== template.format)
    if (fallback) setDuplicateFormat(fallback.id)
  }, [duplicateFormat, template.format])

  const selectTemplate = (nextId) => {
    setTemplateId(nextId)
    setTemplate(loadPosterTemplate(nextId))
    setStatus('')
  }

  const changeBox = (boxName, nextBox) => setTemplate((current) => ({ ...current, [boxName]: nextBox }))
  const patchSelectedBox = (field, value) => changeBox(selectedBox, { ...selected, [field]: value })

  const centerBox = (axis) => {
    if (axis === 'x') patchSelectedBox('x', Number(((100 - selected.width) / 2).toFixed(2)))
    else patchSelectedBox('y', Number(((100 - selected.height) / 2).toFixed(2)))
  }

  const updateTextScale = (field, scale) => setTemplate((current) => ({
    ...current,
    textStyles: { ...current.textStyles, [field]: { ...current.textStyles[field], scale } },
  }))

  const save = () => {
    savePosterTemplate(template)
    setStatus('Template salvo neste navegador.')
  }

  const restore = () => {
    if (!window.confirm(`Restaurar o padrão de ${template.name}?`)) return
    setTemplate(resetPosterTemplate(template.id))
    setStatus('Padrão restaurado.')
  }

  const duplicate = () => {
    const targetDefault = getDefaultTemplateForFormat(duplicateFormat)
    const target = loadPosterTemplate(targetDefault.id)
    const duplicateConfig = {
      ...target,
      contentBox: structuredClone(template.contentBox),
      priceBox: structuredClone(template.priceBox),
      textStyles: structuredClone(template.textStyles),
      safeArea: template.safeArea,
    }
    savePosterTemplate(duplicateConfig)
    setStatus(`Layout copiado para ${target.name}.`)
  }

  return (
    <div className="page page-cartazes-admin page-view-enter">
      <header className="poster-admin-header">
        <div>
          <Link to="/cartazes" className="poster-admin-back"><ArrowLeft size={16} /> Cartazes</Link>
          <span className="poster-page-kicker">Área administrativa</span>
          <h1>Layout dos fundos</h1>
        </div>
        <div className="poster-admin-header-actions">
          <button type="button" className="poster-button poster-button-secondary" onClick={restore}><RotateCcw size={16} /> Restaurar padrão</button>
          <button type="button" className="poster-button poster-button-primary" onClick={save}><Save size={16} /> Salvar</button>
        </div>
      </header>

      <div className="poster-admin-toolbar poster-panel">
        <label>
          <span>Formato</span>
          <select value={templateId} onChange={(event) => selectTemplate(event.target.value)}>
            {templatesByFormat.map((group) => (
              <optgroup label={group.label} key={group.id}>
                {group.templates.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="poster-admin-check"><input type="checkbox" checked={snapEnabled} onChange={(event) => setSnapEnabled(event.target.checked)} /> Snap</label>
        <SelectField label="Passo" value={snapStep} onChange={(value) => setSnapStep(Number(value))} options={[{ value: 1, label: '1%' }, { value: 2, label: '2%' }]} />
        {status ? <span className="poster-admin-status">{status}</span> : null}
      </div>

      <div className="poster-admin-workspace">
        <section className="poster-panel poster-admin-preview-panel">
          <PosterAdminCanvas
            format={format}
            template={template}
            product={testProduct}
            selectedBox={selectedBox}
            onSelectBox={setSelectedBox}
            onBoxChange={changeBox}
            snapEnabled={snapEnabled}
            snapStep={snapStep}
          />
        </section>

        <aside className="poster-admin-properties">
          <section className="poster-panel poster-admin-section">
            <div className="poster-admin-section-heading"><span>Caixas</span><strong>{BOX_LABELS[selectedBox]}</strong></div>
            <div className="poster-admin-box-tabs">
              {Object.entries(BOX_LABELS).map(([key, label]) => <button type="button" className={selectedBox === key ? 'active' : ''} onClick={() => setSelectedBox(key)} key={key}>{label}</button>)}
            </div>
            <div className="poster-admin-grid-2">
              <NumberField label="X" value={selected.x} onChange={(value) => patchSelectedBox('x', value)} />
              <NumberField label="Y" value={selected.y} onChange={(value) => patchSelectedBox('y', value)} />
              <NumberField label="Largura" value={selected.width} onChange={(value) => patchSelectedBox('width', value)} min={5} />
              <NumberField label="Altura" value={selected.height} onChange={(value) => patchSelectedBox('height', value)} min={5} />
            </div>
            {selectedBox === 'contentBox' ? <NumberField label="Espaçamento" value={selected.gap} onChange={(value) => patchSelectedBox('gap', value)} max={12} step={0.5} /> : null}
            <div className="poster-admin-grid-2">
              <SelectField label="Horizontal" value={selected.alignX} onChange={(value) => patchSelectedBox('alignX', value)} options={[{ value: 'left', label: 'Esquerda' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Direita' }]} />
              <SelectField label="Vertical" value={selected.alignY} onChange={(value) => patchSelectedBox('alignY', value)} options={[{ value: 'top', label: 'Topo' }, { value: 'center', label: 'Centro' }, { value: 'bottom', label: 'Base' }]} />
            </div>
            <div className="poster-admin-inline-actions">
              <button type="button" onClick={() => centerBox('x')}>Centralizar horizontal</button>
              <button type="button" onClick={() => centerBox('y')}>Centralizar vertical</button>
            </div>
          </section>

          <section className="poster-panel poster-admin-section">
            <div className="poster-admin-section-heading"><span>Tipografia</span><strong>Escala relativa</strong></div>
            <div className="poster-admin-scale-list">
              {Object.entries(TEXT_LABELS).map(([field, label]) => (
                <label key={field}><span>{label}</span><input type="range" min="0.25" max="2" step="0.05" value={template.textStyles[field].scale} onChange={(event) => updateTextScale(field, Number(event.target.value))} /><strong>{template.textStyles[field].scale.toFixed(2)}</strong></label>
              ))}
            </div>
          </section>

          <section className="poster-panel poster-admin-section">
            <div className="poster-admin-section-heading"><span>Fundo oficial</span><Image size={16} /></div>
            <div className="poster-admin-background-file"><strong>{template.backgroundFile}</strong><span>{template.backgroundScope === 'sheet' ? 'Fundo da folha completa' : 'Fundo individual por placa'}</span></div>
            <p className="poster-admin-help">O arquivo é definido pela pasta Fundo. Ajuste apenas as caixas e a tipografia deste formato.</p>
            <NumberField label="Área segura" value={template.safeArea} onChange={(value) => setTemplate((current) => ({ ...current, safeArea: value }))} max={20} step={0.5} />
          </section>

          <section className="poster-panel poster-admin-section">
            <div className="poster-admin-section-heading"><span>Texto de teste</span><strong>Não altera produtos</strong></div>
            <div className="poster-admin-test-fields">
              {Object.entries(TEXT_LABELS).map(([field, label]) => <label key={field}><span>{label}</span><input value={testProduct[field]} onChange={(event) => setTestProduct((current) => ({ ...current, [field]: event.target.value.toLocaleUpperCase('pt-BR') }))} /></label>)}
            </div>
          </section>

          <section className="poster-panel poster-admin-section">
            <div className="poster-admin-section-heading"><span>Duplicar layout</span><Copy size={16} /></div>
            <SelectField label="Formato de destino" value={duplicateFormat} onChange={setDuplicateFormat} options={POSTER_FORMAT_OPTIONS.filter((item) => item.id !== template.format).map((item) => ({ value: item.id, label: item.label }))} />
            <button type="button" className="poster-button poster-button-secondary poster-admin-full-button" onClick={duplicate}><Copy size={16} /> Duplicar</button>
          </section>
        </aside>
      </div>
    </div>
  )
}
