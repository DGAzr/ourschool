# Security Policy

## Supported versions

Only the latest OurSchool release receives security fixes.

| Version | Supported |
|---------|-----------|
| Latest stable release | ✅ |
| Earlier stable, beta, and alpha releases | ❌ |

## Reporting a vulnerability

OurSchool is a self-hosted homeschool management system. It stores academic
records for minors — please treat any security issue with appropriate care.

**To report a vulnerability, email: dustan@opsstart.com**

Please include:
- A description of the vulnerability and its potential impact
- Steps to reproduce (version, configuration, request/response if applicable)
- Whether you believe it is exploitable remotely or only locally

I aim to acknowledge reports within 48 hours and provide a fix or mitigation
timeline within 7 days for confirmed vulnerabilities.

Please do **not** open a public GitHub issue for security vulnerabilities until
a fix has been released.

## Scope

The following are in scope:
- Authentication bypass or privilege escalation
- Injection vulnerabilities (SQL, command, template)
- Exposure of sensitive data (passwords, tokens, student records) to unauthorized users
- CSRF or session fixation attacks

The following are generally **out of scope** for a self-hosted single-family deployment:
- Denial-of-service attacks requiring local network access
- Issues requiring physical access to the host machine
- Vulnerabilities in third-party dependencies not yet patched upstream (please report those upstream)
