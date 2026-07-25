# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest (`main`) | ✅ |

## Reporting a Vulnerability

**Please do not open a public GitHub Issue for security vulnerabilities.**

Report vulnerabilities privately via one of:

1. **GitHub Security Advisories** — use the "Report a vulnerability" button on the Security tab of this repository.
2. **Direct contact** — email the maintainers through the GitHub profile.

### What to include

- A clear description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested mitigations

### Response Targets

| Phase | Target |
|-------|--------|
| Initial acknowledgment | 72 hours |
| Triage and severity assessment | 7 days |
| Patch release (critical/high) | 14 days |
| Patch release (medium/low) | 30 days |

## Scope

The following are **in scope**:

- Source code in this repository
- GitHub Actions CI/CD workflows
- Dependency vulnerabilities in `requirements.txt` and `package.json`
- Environment configuration and secrets handling

The following are **out of scope**:

- Third-party infrastructure (Render, Twilio, Anthropic, etc.)
- Social engineering attacks

## Security Measures in Place

- GitHub Dependabot for automated dependency updates
- CodeQL static analysis on every push/PR to `main`
- Secret scanning enabled at the repository level
- No secrets stored in source code (use `.env` locally, platform env vars in production)
- HTTPS enforced in production (Render)
- JWT-based authentication with configurable secrets

## Disclosure Policy

We follow a **coordinated disclosure** model. Once a vulnerability is patched and released, we will acknowledge the reporter (with their permission) in release notes.
