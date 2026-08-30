from fastapi import APIRouter
from db.database import get_db_connection

router = APIRouter()

@router.get("/api/stations")
def get_stations():
    conn = get_db_connection()
    stations = conn.execute("SELECT * FROM stations").fetchall()
    
    # Get health for each
    results = []
    for s in stations:
        h = conn.execute("SELECT * FROM sensor_health WHERE station_id = ?", (s['station_id'],)).fetchone()
        
        results.append({
            "station_id": s['station_id'],
            "name": s['name'],
            "lat": s['lat'],
            "lon": s['lon'],
            "health": dict(h) if h else None
        })
    conn.close()
    return results

@router.get("/api/stations/{station_id}/readings")
def get_readings(station_id: str, limit: int = 100):
    conn = get_db_connection()
    readings = conn.execute(
        "SELECT * FROM readings WHERE station_id = ? ORDER BY ts DESC LIMIT ?", 
        (station_id, limit)
    ).fetchall()
    conn.close()
    
    return [dict(r) for r in reversed(readings)]
