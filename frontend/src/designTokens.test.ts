import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')
const lightTheme = css.match(/:root\s*{([\s\S]*?)\n}/)?.[1] ?? ''

const color = (token: string) => {
  const value = lightTheme.match(new RegExp(`--${token}:\\s*(#[0-9A-Fa-f]{6})`))?.[1]
  if (!value) throw new Error(`Missing light-theme color token: ${token}`)
  return value
}

const luminance = (hex: string) => {
  const channels = hex.slice(1).match(/.{2}/g)!.map((part) => parseInt(part, 16) / 255)
  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  )
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

const contrast = (foreground: string, background: string) => {
  const first = luminance(foreground)
  const second = luminance(background)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

describe('light theme text contrast', () => {
  it.each([
    ['muted', 'panel'],
    ['faint', 'panel'],
    ['faintest', 'panel'],
    ['accent', 'panel'],
    ['pos', 'panel'],
    ['warn', 'panel'],
    ['gold', 'panel'],
    ['neutral', 'panel'],
    ['info', 'panel'],
    ['neg', 'panel'],
    ['pos-fg', 'pos-bg'],
    ['info-fg', 'info-bg'],
    ['sub-fg', 'sub-bg'],
    ['exc-fg', 'exc-bg'],
    ['neg-fg', 'neg-bg'],
    ['ns-fg', 'ns-bg'],
  ])('%s is readable on %s', (foreground, background) => {
    expect(contrast(color(foreground), color(background))).toBeGreaterThanOrEqual(4.5)
  })
})
