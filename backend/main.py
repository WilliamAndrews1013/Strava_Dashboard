import os
import requests
import time
import httpx

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from datetime import datetime, timezone
from dotenv import load_dotenv

from database import supabase
from auth.router import router as auth_router

load_dotenv()

class StravaWebhookPayload(BaseModel):
    object_type: str
    aspect_type: str
    object_id: int
    owner_id: int
    subscription_id: int
    event_time: int

# Load variables from .env file
CLIENT_ID = os.getenv("STRAVA_CLIENT_ID")
CLIENT_SECRET = os.getenv("STRAVA_CLIENT_SECRET")
VERIFY_TOKEN = os.getenv("STRAVA_VERIFY_TOKEN")
REDIRECT_URI = os.getenv("REDIRECT_URI")
app = FastAPI()

# Include auth router
app.include_router(auth_router)

# Configure CORS so React frontend can access the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173",  "http://localhost:3000", "https://wasting-casually-translate.ngrok-free.dev"],    # Default Vite port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_valid_access_token(athlete_id: int) -> str:
    """Helper function to fetch and validate/refresh the Strava access token."""
    token_query = None

    for attempt in range(3):
        try:
            token_query = supabase.table("strava_auth").select("*").eq("athlete_id", athlete_id).execute()
            break
        except(
            httpx.ReadError,
            httpx.ConnectError,
            httpx.TimeoutException
        ) as e:
            print(
                f"Supabase connection error"
                f"(attempt {attempt + 1}/3): {e}"
            )

            if attempt == 2:
                raise HTTPException(
                    status_code=503,
                    detail="Could not connect to supabase"
                )
            time.sleep(0.5)
    
    if not token_query.data:
        raise HTTPException(status_code=404, detail=f"No tokens found for Athlete ID {athlete_id}. Please login first.")
        
    token_record = token_query.data[0]
    access_token = token_record["access_token"]
    refresh_token = token_record["refresh_token"]
    expires_at = datetime.fromisoformat(token_record["expires_at"].replace("Z", "+00:00"))

    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    # Refresh token if expired
    if datetime.now(timezone.utc) >= expires_at:
        auth_url = "https://www.strava.com/oauth/token"
        auth_payload = {
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        }
        auth_res = requests.post(auth_url, data=auth_payload)
        if auth_res.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to refresh Strava token.")
            
        auth_data = auth_res.json()
        access_token = auth_data.get("access_token")
        new_expires_at = datetime.fromtimestamp(auth_data.get("expires_at"), tz=timezone.utc)
        
        supabase.table("strava_auth").upsert({
            "athlete_id": athlete_id,
            "access_token": access_token,
            "refresh_token": auth_data.get("refresh_token", refresh_token),
            "expires_at": new_expires_at.isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }).execute()

    return access_token

def calculate_km_splits(streams):
    distance = streams.get("distance", {}).get("data", [])
    time = streams.get("time", {}).get("data", [])
    heartrate = streams.get("heartrate", {}).get("data", [])
    altitude = streams.get("altitude", {}).get("data", [])
    moving = streams.get("moving", {}).get("data", [])

    # Calculate buckets
    if len(distance) < 2 or len(time) < 2:
        return []

    buckets = {}

    for i in range(1, min(len(distance), len(time))):
        previous_distance = distance[i - 1]
        current_distance = distance[i]

        km = int(previous_distance // 1000) + 1

        if km not in buckets:
            buckets[km] = {
                "distance": 0,
                "moving_time": 0,
                "heart_rates": [],
                "elevation_gain": 0,
            }

        bucket = buckets[km]

        distance_delta = max(
            0,
            current_distance - previous_distance
        )

        time_delta = max(
            0,
            time[i] - time[i - 1]
        )

        bucket["distance"] += distance_delta

        is_moving = (not moving or i >= len(moving) or moving[i])

        if is_moving:
            bucket["moving_time"] += time_delta

        if i < len(heartrate):
            bucket["heart_rates"].append(heartrate[i])

        if (i < len(altitude) and i - 1 < len(altitude)):
            elevation_delta = altitude[i] - altitude[i - 1]

            if elevation_delta > 0:
                bucket["elevation_gain"] += elevation_delta

    splits = []

    for km, bucket in sorted(buckets.items()):
        if bucket["distance"] <= 0:
            continue

        pace_seconds = bucket["moving_time"] / bucket["distance"] * 1000

        hr_values = bucket["heart_rates"]

        average_hr = (
            round(sum(hr_values) / len(hr_values))
            if hr_values
            else None
        )

        splits.append({
            "km": km,
            "pace_Seconds": round(
                pace_seconds,
                1
            ),
            "average_hr": average_hr,
            "elevation_gain": round(
                bucket["elevation_gain"],
                1
            ),
        })
    return splits

@app.post("/sync")
def sync_activities(refresh_token: str = Query(..., description="Your Strava account refresh token")):
    auth_url = "https://www.strava.com/oauth/token"
    auth_payload = {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
    }

    auth_res = requests.post(auth_url, data=auth_payload)

    if auth_res.status_code != 200:
        raise HTTPException(status_code=400, detail="Invalid refresh token provided")

    access_token = auth_res.json().get("access_token")

    header = {"Authorization": f"Bearer {access_token}"}
    activities_url = "https://www.strava.com/api/v3/athlete/activities"
    activities_res = requests.get(
        activities_url, 
        headers=header,
        params={
            "page": 1,
            "per_page": 200
        }
    )

    if activities_res.status_code != 200:
        raise HTTPException(status_code=500, detail="Could not pull activities from Strava")

    activities = activities_res.json()

    # Upsert records to supabase
    success_count = 0
    for act in activities:
        data = {
            "activity_id": act.get("id"),
            "athlete_id": act.get("athlete", {}).get("id"),
            "name": act.get("name"),
            "distance_meters": act.get("distance"),
            "moving_time_seconds": act.get("moving_time"),
            "elapsed_time_seconds": act.get("elapsed_time"),
            "total_elevation_gain": act.get("total_elevation_gain"),
            "activity_type": act.get("sport_type") or act.get("type"),
            "start_date_local": act.get("start_date_local"),
            "summary_polyline": (act.get("map") or {}).get("summary_polyline"),
        }
        try:
            supabase.table("activities").upsert(data).execute()
            success_count += 1
        except Exception as e:
            print(f"Error skipping activity {act['id']}: {str(e)}")

    return {"status": "success", "synced_records": success_count}

@app.get("/activities/{activity_id}")
def get_complete_activity(activity_id: int):
    # Look for activity in supabase
    db_query = supabase.table("activities").select("*").eq("activity_id", activity_id).limit(1).execute()

    if db_query.data:
        activity_record = db_query.data[0]
        # If we have raw deep payload, serve from db instead
        if activity_record.get("raw_payload"):
            return {
                "source": "database",
                "activity_data": activity_record["raw_payload"]
            }

    # Get athlete ID from db row
    athlete_id = activity_record["athlete_id"]

    # If missing, pull full payload from Strava API
    access_token = get_valid_access_token(athlete_id)

    header = {
        "Authorization": f"Bearer {access_token}"
    }
    
    strava_url = f"https://www.strava.com/api/v3/activities/{activity_id}"
    
    strava_res = requests.get(strava_url, headers=header)
    
    if strava_res.status_code == 404:
        raise HTTPException(
            status_code=404,
            detail="Activity not found on Strava"
        )
    
    if strava_res.status_code != 200:
        print("STRAVA ERROR:", strava_res.status_code)
        print("RESPONSE:", strava_res.text)
    
        raise HTTPException(
            status_code=strava_res.status_code,
            detail=f"Failed fetching detailed activity: {strava_res.text}"
        )
    
    detailed_activity = strava_res.json()

    # Cache only the raw payload

    try:
        supabase.table("activities").update({"raw_payload" : detailed_activity}).eq("activity_id", activity_id).execute()
    except Exception as e:
        print(f"Failed caching full activity {activity_id} to database: {str(e)}")

    return {
        "source": "strava_api",
        "activity_data": detailed_activity
    }

@app.get("/detailed_activities")
def get_strava_activities():
    try:
        response = (
            supabase.table("activities").select("*").eq("activity_type", "Run").order("start_date_local", desc=True).execute()
        )

        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch activities: {str(e)}")

@app.get("/activities/{activity_id}/metrics")
def get_activity_stream(activity_id: int):
    # Check supabase
    db_query = (
        supabase.table("data_streams").select("streams").eq("activity_id", activity_id).limit(1).execute()
    )

    if db_query.data:
        streams = db_query.data[0]["streams"]

        return {
            "source": "database",
            "splits": calculate_km_splits(streams)
        }

    # Find athlete
    activity_result = (
        supabase.table("activities").select("athlete_id").eq("activity_id", activity_id).limit(1).execute()
    )

    if not activity_result.data:
        raise HTTPException(
            status_code=404,
            detail="Activity not found"
        )

    athlete_id = activity_result.data[0]["athlete_id"]

    # Get valid access token
    access_token = get_valid_access_token(athlete_id)

    # Fetch streams from strava
    response = requests.get(
        f"https://www.strava.com/api/v3/activities/{activity_id}/streams",
        headers={
            "Authorization": f"Bearer {access_token}"
        },
        params={
            "keys": "distance,time,heartrate,altitude,moving",
            "key_by_type": "true",
        },
    )

    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail=response.text
        )

    streams = response.json()

    # Save raw streams
    record = {
        "activity_id": activity_id,
        "athlete_id": athlete_id,
        "streams": streams
    }

    supabase.table("data_streams").upsert(record).execute()

    # Calculate and return metrics
    return {
        "source": "strava",
        "splits": calculate_km_splits(streams)
    }