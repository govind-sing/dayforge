from supabase import create_client, Client
from app.core.config import settings

# Service role client — bypasses RLS, used by backend after we've
# verified the user ourselves via JWT.
supabase: Client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_SERVICE_ROLE_KEY
)