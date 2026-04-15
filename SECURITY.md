# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Which versions receive security updates depends on the CVSS v3.0 Rating:

| Version | Supported          |
| ------- | :----------------- |
| 0.x.x   | :white_check_mark: |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report security vulnerabilities to **security@mindfiredigital.com**.

Please include the requested information listed below (as much as you can provide) to help us better understand the nature and scope of the possible issue:

- **Type of issue** (e.g. buffer overflow, SQL injection, cross-site scripting, etc.)
- **Full paths of source file(s) related to the manifestation** of the issue
- **The location of the affected source code** (tag/branch/commit or direct URL)
- **Any special configuration required** to reproduce the issue
- **Step-by-step instructions to reproduce** the issue
- **Proof-of-concept or exploit code** (if possible)
- **Impact of the issue**, including how an attacker might exploit the issue

This information will help us triage your report more quickly.

## Disclosure Policy

When we receive a security vulnerability report, we commit to the following process:

- Confirm the problem and determine the affected versions.
- Review the code to find any potential similar issues.
- Prepare fixes for all releases still under maintenance.
- Release new security fix releases as soon as possible.

## Comments on this Policy

If you have suggestions on how this process could be improved, please submit them to **security@mindfiredigital.com**.

## Security Updates

Security vulnerabilities are fixed in the following way:

1. **Critical vulnerabilities** (CVSS 9.0-10.0): Emergency patch released immediately
2. **High vulnerabilities** (CVSS 7.0-8.9): Patch released within 1 week
3. **Medium vulnerabilities** (CVSS 4.0-6.9): Patch released within 2 weeks
4. **Low vulnerabilities** (CVSS 0.1-3.9): Fixed in next regular release

## Security Best Practices for Users

### Installation

- Always use `npm ci` or `pnpm install --frozen-lockfile` in CI/CD environments
- Regularly update dependencies: `npm audit fix` or `pnpm audit --fix`
- Use `npm audit -l high` to check for known vulnerabilities

###Usage

- Keep ADAC and its dependencies up to date
- Review dependency security advisories regularly
- Use package locks in version control

## Acknowledgments

Thank you for helping keep ADAC and our users safe!

Humans responsible for security can be reached at **security@mindfiredigital.com**
