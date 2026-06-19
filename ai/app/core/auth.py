from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.supabase_client import supabase

bearer = HTTPBearer()

async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(bearer)
) -> str:
    try:
        response = supabase.auth.get_user(credentials.credentials)
        return response.user.id
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")