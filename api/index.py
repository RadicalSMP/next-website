from fastapi import FastAPI

app = FastAPI(docs_url="/api/docs", openapi_url="/api/openapi.json")

@app.get("/api/check")
def check():
    return {"status": "ok"}