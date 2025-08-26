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
    <div className={`prose prose-sm max-w-none dark:prose-invert ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
        // Customize component rendering for better styling
        h1: ({ children }) => (
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-6 mb-3 first:mt-0">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mt-5 mb-2">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mt-4 mb-2">
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p className="text-gray-700 dark:text-gray-300 mb-3 last:mb-0">
            {children}
          </p>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 mb-3 space-y-1">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside text-gray-700 dark:text-gray-300 mb-3 space-y-1">
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="text-gray-700 dark:text-gray-300">
            {children}
          </li>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 py-2 my-3 bg-gray-50 dark:bg-gray-800 rounded-r">
            {children}
          </blockquote>
        ),
        code: ({ children, ...props }) => {
          const isInline = !props.className
          if (isInline) {
            return (
              <code className="bg-gray-100 dark:bg-gray-800 text-red-600 dark:text-red-400 px-1 py-0.5 rounded text-sm font-mono">
                {children}
              </code>
            )
          }
          return (
            <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md overflow-x-auto my-3">
              <code className="text-sm font-mono text-gray-800 dark:text-gray-200">
                {children}
              </code>
            </pre>
          )
        },
        strong: ({ children }) => (
          <strong className="font-semibold text-gray-900 dark:text-gray-100">
            {children}
          </strong>
        ),
        em: ({ children }) => (
          <em className="italic text-gray-700 dark:text-gray-300">
            {children}
          </em>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-4">
            <table className="min-w-full border border-gray-300 dark:border-gray-600 rounded-lg">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-gray-50 dark:bg-gray-800">
            {children}
          </thead>
        ),
        th: ({ children }) => (
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-300 dark:border-gray-600">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-4 py-2 text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
            {children}
          </td>
        ),
        hr: () => (
          <hr className="my-6 border-gray-300 dark:border-gray-600" />
        )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export default MarkdownRenderer