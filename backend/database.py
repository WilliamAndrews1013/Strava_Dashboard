import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client, Client

env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SECRET_KEY")

if not SUPABASE_URL:
    raise RuntimeError("SUPABASE_URL is missing")

if not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_SECRECT_KEY is missing")

supabase: Client = create_client(SUPABASE_URL,SUPABASE_KEY)