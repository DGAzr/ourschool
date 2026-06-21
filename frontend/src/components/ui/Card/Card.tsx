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

import React, { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: boolean
}

interface CardHeaderProps {
  children: ReactNode
  className?: string
}

interface CardContentProps {
  children: ReactNode
  className?: string
  padding?: boolean
}

interface CardFooterProps {
  children: ReactNode
  className?: string
}

const Card: React.FC<CardProps> = ({ children, className = '', padding = true }) => (
  <div
    className={[
      'bg-panel border border-line rounded-card shadow-card',
      padding ? 'p-4' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
  >
    {children}
  </div>
)

const CardHeader: React.FC<CardHeaderProps> = ({ children, className = '' }) => (
  <div className={`px-5 py-4 border-b border-line ${className}`}>{children}</div>
)

const CardContent: React.FC<CardContentProps> = ({ children, className = '', padding = true }) => (
  <div className={`${padding ? 'p-5' : ''} ${className}`}>{children}</div>
)

const CardFooter: React.FC<CardFooterProps> = ({ children, className = '' }) => (
  <div className={`px-5 py-4 border-t border-line ${className}`}>{children}</div>
)

interface CardComponent extends React.FC<CardProps> {
  Header: React.FC<CardHeaderProps>
  Content: React.FC<CardContentProps>
  Footer: React.FC<CardFooterProps>
}

const CardWithSubComponents = Card as CardComponent
CardWithSubComponents.Header = CardHeader
CardWithSubComponents.Content = CardContent
CardWithSubComponents.Footer = CardFooter

export default CardWithSubComponents
