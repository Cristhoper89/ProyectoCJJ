# backend

A project created with FastAPI CLI.

## Quick Start

### Configure environment variables

If `backend/.env` does not exist, create it from `.env.example`. If it already
exists, keep its current values and add or update the Cloudinary variables
there. Use a local or test database because startup runs schema updates. Keep
`.env` private; it is ignored by Git.

On Windows PowerShell, from the repository root:

```powershell
if (!(Test-Path backend\.env)) { Copy-Item backend\.env.example backend\.env }
```

### Start the development server

```bash
uv run fastapi dev
```

Visit http://localhost:8000

### Deploy to FastAPI Cloud

Sign up and log in at https://fastapicloud.com, then deploy with:

```bash
uv run fastapi deploy
```

## Project Structure

- `main.py` - Your FastAPI application
- `pyproject.toml` - Project dependencies

## Learn More

- [FastAPI Documentation](https://fastapi.tiangolo.com)
- [FastAPI Cloud](https://fastapicloud.com)
