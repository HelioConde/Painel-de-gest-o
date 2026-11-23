// Renderizar uma placa com as caixas de outro modelo causa falhas ao trocar
// rapidamente entre App e formatos comuns. Resolve o template no próprio
// render, sem esperar o efeito de atualização do estado.
export function resolveActivePosterTemplate(format, template, loadDefault) {
  if (template?.format === format.id && (
    format.specialLayout !== 'app-offer' ||
    (template.appTitleBox && template.textStyles?.appTitle)
  )) return template
  return loadDefault(format.id)
}
