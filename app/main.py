# Entrypoint for the FastAPI application, lifespan, middleware, root routing.
import sys
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import asynccontextmanager
from app.core.config import settings
from app.core.db import init_db
from app.api.v1.router import api_router

# Lifespan event handlers : Automatically create connection and create SQLite tables when the application starts up
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Automatically create database tables if they are not existing
    await init_db()
    yield

# Init FastAPI app
app= FastAPI(
    title=settings.APP_NAME,
    version=settings.API_V1_STR,
    lifespan=lifespan
)

# Add CORSMiddleweare separately
app.add_middleware(
    CORSMiddleware,
    allow_origins = ["*"],
    allow_credentials = True,
    allow_methods= ["*"],
    allow_headers= ["*"],

)

@app.get("/")
def read_root():
    return {
        "message": "Welcome to Chat Playground API",
        "docs": "/docs"
    }

@app.get(f"{settings.API_V1_STR}/health")
def health_check():
    return {"status": "ok"}

# Mount API routes
app.include_router(api_router, prefix=settings.API_V1_STR)

if __name__ == "__main__":
    uvicorn.run("app.main:app", host = "0.0.0.0", port=settings.PORT, reload=True)


#run uvicorn app.main:app --reload
