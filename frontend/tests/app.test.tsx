import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from '../src/App'

describe('Painel de Gestão', () => {
  it('renderiza o dashboard e a sidebar', () => {
    render(<App />)
    expect(screen.getByText('PAINEL DE GESTÃO')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Painel de Gestão' })).toBeInTheDocument()
  })

  it('expõe as rotas principais na navegação', () => {
    render(<App />)
    expect(screen.getByRole('link', { name: 'Eventos' })).toHaveAttribute('href', '/eventos')
    expect(screen.getByRole('link', { name: 'Perdas' })).toHaveAttribute('href', '/perdas')
  })

  it.each([
    ['/', 'Painel de Gestão'],
    ['/eventos', 'Eventos'],
    ['/venda-diaria', 'Venda Diária'],
    ['/venda-mensal', 'Venda Mensal'],
    ['/fechamento-mensal', 'Fechamento Mensal'],
    ['/perdas', 'Perdas'],
  ])('renderiza %s', (path, title) => {
    window.history.pushState({}, '', path)
    const view = render(<App />)
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    view.unmount()
  })
})
