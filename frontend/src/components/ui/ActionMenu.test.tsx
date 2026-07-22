/*
 * OurSchool - Homeschool Management System
 * Copyright (C) 2025 Dustan Ashley
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import ActionMenu from './ActionMenu'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('ActionMenu', () => {
  it('portals the menu outside an overflow-clipping container', () => {
    render(
      <div data-testid="inset-list" style={{ overflow: 'hidden' }}>
        <ActionMenu
          ariaLabel="Row actions"
          items={[{ label: 'Edit', onSelect: vi.fn() }]}
        />
      </div>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Row actions' }))

    const insetList = screen.getByTestId('inset-list')
    const menu = screen.getByRole('menu')
    expect(insetList).not.toContainElement(menu)
    expect(document.body).toContainElement(menu)
  })

  it('opens above the trigger when there is more room above', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.querySelector('[aria-label="Bottom row actions"]')) {
        return {
          bottom: 790,
          height: 30,
          left: 970,
          right: 1000,
          top: 760,
          width: 30,
          x: 970,
          y: 760,
          toJSON: () => ({}),
        }
      }
      return {
        bottom: 0,
        height: 0,
        left: 0,
        right: 0,
        top: 0,
        width: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }
    })
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(180)
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(160)
    vi.stubGlobal('innerHeight', 800)
    vi.stubGlobal('innerWidth', 1024)

    render(
      <ActionMenu
        ariaLabel="Bottom row actions"
        items={[
          { label: 'Edit', onSelect: vi.fn() },
          'separator',
          { label: 'Delete', onSelect: vi.fn(), danger: true },
        ]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Bottom row actions' }))

    const menu = screen.getByRole('menu')
    expect(menu).toHaveStyle({ left: '840px', top: '576px', visibility: 'visible' })
    expect(menu.style.transformOrigin).toBe('bottom right')
  })

  it('keeps portal menu clicks inside and invokes the selected action', () => {
    const onSelect = vi.fn()
    render(
      <ActionMenu
        ariaLabel="Row actions"
        items={[{ label: 'Edit', onSelect }]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Row actions' }))
    const item = screen.getByRole('menuitem', { name: 'Edit' })
    fireEvent.mouseDown(item)
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.click(item)
    expect(onSelect).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
