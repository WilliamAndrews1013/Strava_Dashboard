import os
import requests
from pathlib import Path
from datetime import datetime, timezone
from fastapi.responses import RedirectResponse
from fastapi import APIRouter, HTTPException, Query
from database import supabase

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)

# Strava config
CLIENT_ID = os.getenv("STRAVA_CLIENT_ID")
CLIENT_SECRET = os.getenv("STRAVA_CLIENT_SECRET")
REDIRECT_URI = os.getenv("REDIRECT_URI")

@router.get("/login")
def strava_login():
    # 'activity:read_all' scope is required to see full history
    scope = "read,activity:read_all"
    strava_auth_url = (
        f"https://www.strava.com/oauth/authorize"
        f"?client_id={CLIENT_ID}"
        f"&redirect_uri={REDIRECT_URI}"
        f"&response_type=code"
        f"&scope={scope}"
        f"&approval_prompt=force"
    )
    return RedirectResponse(url=strava_auth_url)

@router.get("/callback")
def strava_callback(code: str = Query(...)):
    # FIXED: Added www. to the endpoint URL
    token_url = "https://www.strava.com/oauth/token"
    
    payload = {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "code": code,
        "grant_type": "authorization_code"
    }

    response = requests.post(token_url, data=payload)
    if response.status_code != 200:
        # Useful for debugging what Strava actually complained about
        error_detail = response.json().get("message", "Failed to retrieve token from Strava.")
        raise HTTPException(status_code=400, detail=error_detail)

    token_data = response.json()
    athlete_id = token_data.get("athlete", {}).get("id")

    # Convert Strava unix timestamp to ISO timestamp for Supabase
    expires_at_dt = datetime.fromtimestamp(token_data.get("expires_at"), tz=timezone.utc)

    # Prepare token data payload
    token_record = {
        "athlete_id": athlete_id,
        "access_token": token_data.get("access_token"),
        "refresh_token": token_data.get("refresh_token"),
        "expires_at": expires_at_dt.isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    try:
        supabase.table("strava_auth").upsert(token_record).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error saving tokens: {str(e)}")

    return {
        "status": "success", 
        "message": f"Tokens securely saved for Athlete {athlete_id}"
    }