from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI(
    title="CreditFix API",
    description="PDF parsing and AI analysis backend for CreditFix",
    version="0.1.0",
)

# CORS — allow the frontend origin (per D-13)
# FRONTEND_URL is set in Railway env vars for production.
# Defaults to localhost:3000 for local development.
# Note: Vercel preview URLs are dynamic — update FRONTEND_URL env var for preview testing.
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers.reports import router as reports_router
app.include_router(reports_router)

from routers.letters import router as letters_router
app.include_router(letters_router)

from routers.responses import router as responses_router
app.include_router(responses_router)

from routers.complaints import router as complaints_router
app.include_router(complaints_router)


@app.get("/api/health")
def health_check():
    """Health check endpoint for deployment verification (per D-14)."""
    return {"status": "ok", "service": "creditfix-api"}
