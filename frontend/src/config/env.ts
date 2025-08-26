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

/**
 * Environment configuration for the frontend application
 * All environment variables must be prefixed with VITE_ to be available in the browser
 */

export const config = {
  // Authentication Settings
  auth: {
    // Token expiration time in milliseconds (default: 24 hours)
    tokenExpiryMs: parseInt(import.meta.env.VITE_AUTH_TOKEN_EXPIRY_MS || '86400000'),
    
    // Warning time before logout in milliseconds (default: 5 minutes)
    logoutWarningMs: parseInt(import.meta.env.VITE_AUTH_LOGOUT_WARNING_MS || '300000'),
  },
  
  // API Configuration
  api: {
    baseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
  },
  
  // Application Settings
  app: {
    name: import.meta.env.VITE_APP_NAME || 'OurSchool - Homeschool Management',
    version: import.meta.env.VITE_APP_VERSION || '1.0.0',
  },
  
  // Development Settings
  dev: {
    debugMode: import.meta.env.VITE_DEBUG_MODE === 'true',
  }
} as const

// Validate configuration on load
if (config.auth.tokenExpiryMs < 60000) {
  console.warn('Token expiry time is less than 1 minute. This may cause frequent logouts.')
}

if (config.auth.logoutWarningMs >= config.auth.tokenExpiryMs) {
  console.warn('Logout warning time should be less than token expiry time.')
}