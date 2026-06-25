from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    GEMINI_API_KEY: str
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    CHROMA_PATH: str = "/data/chroma"
    FRONTEND_URL: str = "http://localhost:3000"
    JINA_API_KEY: str

    class Config:
        env_file = ".env"

settings = Settings()