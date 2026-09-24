import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

#Init FastAPI app
app= FastAPI(
    title=settings.APP_NAME,
    version=settings.API_V1_STR
    
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

if __name__ == "__main__":
    uvicorn.run("app.main:app", host = "0.0.0.0", port=settings.PORT, reload=True)


#run uvicorn app.main:app --reload