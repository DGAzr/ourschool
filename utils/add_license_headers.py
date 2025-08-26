#!/usr/bin/env python3
"""
Script to add AGPL license headers to source files.
Run this from the project root directory: python utils/add_license_headers.py
"""

import os
import sys
from pathlib import Path

# License header for Python files
PYTHON_HEADER = '''# OurSchool - Homeschool Management System
# Copyright (C) 2025 Dustan Ashley
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

'''

# License header for TypeScript/JavaScript files
JS_HEADER = '''/*
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

'''

def has_license_header(file_path: Path) -> bool:
    """Check if file already has a license header."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read(500)  # Read first 500 chars
            return 'GNU Affero General Public License' in content
    except Exception:
        return False

def add_header_to_file(file_path: Path, header: str) -> bool:
    """Add license header to a file."""
    if has_license_header(file_path):
        print(f"Skipping {file_path} (already has header)")
        return False
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            original_content = f.read()
        
        # Add header at the beginning
        new_content = header + original_content
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        print(f"Added header to {file_path}")
        return True
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False

def main():
    """Main function to add headers to all source files."""
    # Check if running from project root
    project_root = Path.cwd()
    if not (project_root / 'app').exists() or not (project_root / 'frontend').exists():
        print("Error: Please run this script from the project root directory.")
        print("Usage: python utils/add_license_headers.py")
        sys.exit(1)
    
    # Python files in app directory
    python_files = list(project_root.glob('app/**/*.py'))
    
    # TypeScript/JavaScript files in frontend/src
    js_files = list(project_root.glob('frontend/src/**/*.ts')) + \
               list(project_root.glob('frontend/src/**/*.tsx'))
    
    # Filter out node_modules and other build directories
    js_files = [f for f in js_files if 'node_modules' not in str(f)]
    
    print(f"Found {len(python_files)} Python files")
    print(f"Found {len(js_files)} TypeScript files")
    
    added_count = 0
    
    # Add headers to Python files
    for file_path in python_files:
        if add_header_to_file(file_path, PYTHON_HEADER):
            added_count += 1
    
    # Add headers to TypeScript files
    for file_path in js_files:
        if add_header_to_file(file_path, JS_HEADER):
            added_count += 1
    
    print(f"\nLicense header addition complete!")
    print(f"Added headers to {added_count} files")

if __name__ == '__main__':
    main()