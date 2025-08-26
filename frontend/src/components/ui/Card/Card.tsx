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
import { CARD_STYLES } from '../../../constants'

/**
 * Props for the main Card component
 */
interface CardProps {
  /** Content to display inside the card */
  children: ReactNode
  /** Additional CSS classes to apply */
  className?: string
  /** Whether to apply default padding @default true */
  padding?: boolean
}

/**
 * Props for the CardHeader component
 */
interface CardHeaderProps {
  /** Content to display in the card header */
  children: ReactNode
  /** Additional CSS classes to apply */
  className?: string
}

/**
 * Props for the CardContent component
 */
interface CardContentProps {
  /** Content to display in the card body */
  children: ReactNode
  /** Additional CSS classes to apply */
  className?: string
  /** Whether to apply default padding @default true */
  padding?: boolean
}

/**
 * Props for the CardFooter component
 */
interface CardFooterProps {
  /** Content to display in the card footer */
  children: ReactNode
  /** Additional CSS classes to apply */
  className?: string
}

/**
 * A container component that provides consistent styling and layout for content.
 * Supports a compound component pattern with Header, Content, and Footer subcomponents.
 * 
 * @component
 * @example
 * ```tsx
 * <Card>
 *   <Card.Header>
 *     <h2>Card Title</h2>
 *   </Card.Header>
 *   <Card.Content>
 *     <p>Card content goes here...</p>
 *   </Card.Content>
 *   <Card.Footer>
 *     <Button>Action</Button>
 *   </Card.Footer>
 * </Card>
 * ```
 */
const Card: React.FC<CardProps> = ({ 
  children, 
  className = '', 
  padding = true 
}) => {
  const cardClasses = [
    CARD_STYLES.base,
    padding ? '' : 'p-0',
    className
  ].filter(Boolean).join(' ')

  return (
    <div className={cardClasses}>
      {children}
    </div>
  )
}

/**
 * Header section of a Card component.
 * Typically used for titles, actions, or navigation elements.
 */
const CardHeader: React.FC<CardHeaderProps> = ({ 
  children, 
  className = '' 
}) => {
  const headerClasses = [
    CARD_STYLES.header,
    className
  ].filter(Boolean).join(' ')

  return (
    <div className={headerClasses}>
      {children}
    </div>
  )
}

/**
 * Main content area of a Card component.
 * Contains the primary content and information.
 */
const CardContent: React.FC<CardContentProps> = ({ 
  children, 
  className = '',
  padding = true 
}) => {
  const contentClasses = [
    padding ? CARD_STYLES.content : '',
    className
  ].filter(Boolean).join(' ')

  return (
    <div className={contentClasses}>
      {children}
    </div>
  )
}

/**
 * Footer section of a Card component.
 * Typically used for actions, buttons, or additional information.
 */
const CardFooter: React.FC<CardFooterProps> = ({ 
  children, 
  className = '' 
}) => {
  const footerClasses = [
    CARD_STYLES.footer,
    className
  ].filter(Boolean).join(' ')

  return (
    <div className={footerClasses}>
      {children}
    </div>
  )
}

/**
 * Compound component pattern with proper typing.
 * Allows for Card.Header, Card.Content, and Card.Footer usage.
 */
interface CardComponent extends React.FC<CardProps> {
  /** Header subcomponent for card titles and actions */
  Header: React.FC<CardHeaderProps>
  /** Content subcomponent for main card content */
  Content: React.FC<CardContentProps>
  /** Footer subcomponent for actions and additional info */
  Footer: React.FC<CardFooterProps>
}

const CardWithSubComponents = Card as CardComponent
CardWithSubComponents.Header = CardHeader
CardWithSubComponents.Content = CardContent
CardWithSubComponents.Footer = CardFooter

export default CardWithSubComponents