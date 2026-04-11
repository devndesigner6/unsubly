# Contributing to Unsubscribely

Thank you for your interest in contributing! This document outlines the process for contributing to Unsubscribely.

## Getting Started

1. **Fork** the repository
2. **Clone** your fork:
   ```bash
   git clone https://github.com/<your-username>/unsubly.git
   cd unsubly
   ```
3. **Install dependencies:**
   ```bash
   npm install
   ```
4. **Set up environment variables** (see `README.md → Environment Variables`)
5. **Start the development server:**
   ```bash
   npm run dev
   ```

## Development Guidelines

### Code Style
- TypeScript is required for all source files — avoid `any` where possible
- Components go in `src/components/`, pages in `src/pages/`
- Keep Algorand-specific logic inside `src/lib/algorand/`
- All explorer links must use Lora (`lora.algokit.io`) — never hardcode Pera or AlgoExplorer URLs

### Smart Contracts
- TEAL contracts live in `smart_contracts/`
- All contracts must implement ARC-4 ABI method signatures
- Test on Algorand Testnet before submitting changes
- Compile artifacts go into `smart_contracts/artifacts/`

### Commits
- Use clear, descriptive commit messages
- One logical change per commit
- Reference issues with `Fixes #issue-number` where applicable

## Submitting a Pull Request

1. Create a feature branch: `git checkout -b feat/your-feature-name`
2. Make your changes and commit them
3. Push to your fork: `git push origin feat/your-feature-name`
4. Open a Pull Request against the `main` branch
5. Fill in the PR template completely
6. Wait for review — maintainers aim to respond within 48 hours

## Reporting Bugs

Use the [Bug Report issue template](.github/ISSUE_TEMPLATE/bug_report.md). Include:
- Steps to reproduce
- Expected vs actual behaviour
- Wallet type and network (Testnet / Mainnet)
- Browser and OS

## Suggesting Features

Use the [Feature Request issue template](.github/ISSUE_TEMPLATE/feature_request.md).

## Security Issues

**Do not open a public issue for security vulnerabilities.** See [SECURITY.md](SECURITY.md) for the responsible disclosure process.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
