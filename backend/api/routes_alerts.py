from fastapi import APIRouter
from db.database import get_db_connection

router = APIRouter()

@router.get("/api/alerts")
def get_alerts(status: str = "active"):
    conn = get_db_connection()
    alerts = conn.execute(
        "SELECT * FROM alerts WHERE status = ? ORDER BY ts DESC LIMIT 50", 
        (status,)
    ).fetchall()
    conn.close()
    
    return [dict(a) for a in alerts]

@router.post("/api/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: int):
    conn = get_db_connection()
    conn.execute("UPDATE alerts SET status = 'resolved' WHERE id = ?", (alert_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}
