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

import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'

interface MarkdownRendererProps {
  content: string
  className?: string
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  return (
    <div className={`max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
        // Customize component rendering for better styling
        h1: ({ children }) => (
          <h1 className="text-2xl font-bold text-ink mt-6 mb-3 first:mt-0">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-xl font-semibold text-ink mt-5 mb-2">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-lg font-medium text-ink mt-4 mb-2">
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p className="text-ink-2 mb-3 last:mb-0">
            {children}
          </p>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-inside text-ink-2 mb-3 space-y-1">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside text-ink-2 mb-3 space-y-1">
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="text-ink-2">
            {children}
          </li>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-line pl-4 py-2 my-3 bg-panel-2 rounded-r">
            {children}
          </blockquote>
        ),
        code: ({ children, ...props }) => {
          const isInline = !props.className
          if (isInline) {
            return (
              <code className="bg-track text-accent px-1 py-0.5 rounded text-sm font-mono">
                {children}
              </code>
            )
          }
          return (
            <pre className="bg-panel-2 border border-line p-3 rounded-field overflow-x-auto my-3">
              <code className="text-sm font-mono text-ink-2">
                {children}
              </code>
            </pre>
          )
        },
        strong: ({ children }) => (
          <strong className="font-semibold text-ink">
            {children}
          </strong>
        ),
        em: ({ children }) => (
          <em className="italic text-ink-2">
            {children}
          </em>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            className="text-accent hover:opacity-80 underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-4">
            <table className="min-w-full border border-line rounded-card">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-panel-2">
            {children}
          </thead>
        ),
        th: ({ children }) => (
          <th className="px-4 py-2 text-left text-xs font-semibold text-faint uppercase tracking-wider border-b border-line">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-4 py-2 text-ink-2 border-b border-line-2">
            {children}
          </td>
        ),
        hr: () => (
          <hr className="my-6 border-line" />
        )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export default MarkdownRenderer
