import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import SeventhCpcLevelOptions from '../features/cases/components/SeventhCpcLevelOptions'

describe('new calculation 7th CPC level options', () => {
  it('renders scalar level values and readable labels instead of matrix objects', () => {
    const markup = renderToStaticMarkup(createElement('select', null, createElement(SeventhCpcLevelOptions, {
      levels: [{ level: '1', cells: [] }, { level: '2', cells: [] }],
    })))

    expect(markup).toContain('<option value="1">Level 1</option>')
    expect(markup).toContain('<option value="2">Level 2</option>')
    expect(markup).not.toContain('[object Object]')
  })
})
