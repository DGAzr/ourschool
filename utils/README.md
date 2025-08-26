# OurSchool Utilities

This directory contains utility scripts and templates for maintaining the OurSchool project.

## License Header Management

### Files

- **`add_license_headers.py`** - Script to automatically add AGPL license headers to source files
- **`LICENSE_HEADER.py`** - Template for Python file license headers
- **`LICENSE_HEADER.js`** - Template for TypeScript/JavaScript file license headers

### Usage

To add license headers to all source files in the project:

```bash
# From the project root directory
python utils/add_license_headers.py
```

The script will:
- Scan all Python files in the `app/` directory
- Scan all TypeScript/JavaScript files in the `frontend/src/` directory
- Skip files that already have license headers
- Add appropriate AGPL-3.0 headers based on file type
- Provide a summary of files processed

### License Header Format

The headers include:
- Project name and description
- Copyright notice (© 2025 Dustan Ashley)
- AGPL-3.0 license text
- Link to full license text

### Adding Headers to New Files

When creating new source files, you can either:
1. Run the automated script: `python utils/add_license_headers.py`
2. Manually copy the appropriate header from `LICENSE_HEADER.py` or `LICENSE_HEADER.js`

### AGPL Compliance

These utilities help ensure compliance with the GNU Affero General Public License v3.0 by:
- Adding required copyright notices to all source files
- Including proper license references
- Maintaining consistent attribution across the codebase

For more information about AGPL compliance, see `../AGPL_COMPLIANCE.md`.