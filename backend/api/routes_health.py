from fastapi import APIRouter
from db.database import get_db_connection

router = APIRouter()

@router.get("/api/stations/{station_id}/health")
def get_health(station_id: str):
    conn = get_db_connection()
    h = conn.execute("SELECT * FROM sensor_health WHERE station_id = ?", (station_id,)).fetchone()
    conn.close()
    
    if h:
        return dict(h)
    return {}
