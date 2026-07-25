# Contributing to Roundtable_VO

Thank you for your interest in contributing! This document covers the basics for getting started.

## Prerequisites

- **Node.js** 20+ and npm (for frontend)
- **Python** 3.12+ and pip (for backend)

## Local Setup

```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # fill in your local values

# Frontend
cd frontend
npm ci
cp .env.example .env.local       # fill in REACT_APP_BACKEND_URL
```

## Development Workflow

```bash
# Backend — run dev server
cd backend
uvicorn app:app --reload --port 8001

# Frontend — run dev server
cd frontend
npm start
```

## Code Quality

```bash
# Frontend
cd frontend
npm run lint          # ESLint check
npm run lint:fix      # ESLint auto-fix
npm run format        # Prettier format

# Backend
cd backend
pip install -r requirements-dev.txt
ruff check .          # lint
black --check .       # format check
black .               # format
pytest                # run tests
```

## Pull Request Guidelines

1. Branch from `main` using a descriptive name (`feat/...`, `fix/...`, `chore/...`).
2. Keep PRs focused — one concern per PR.
3. Ensure CI passes before requesting review.
4. Add or update tests for any changed logic.
5. Do **not** commit `.env` files, secrets, or compiled build artifacts.

## Reporting Bugs

Open a GitHub Issue with:
- Steps to reproduce
- Expected vs. actual behavior
- Environment details (OS, Node version, Python version, browser)

## License

This project is **Proprietary — All Rights Reserved © Blue Collar Apps**. By contributing you agree that your contributions may be incorporated under these terms.
