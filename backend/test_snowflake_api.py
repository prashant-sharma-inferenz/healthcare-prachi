from fastapi import APIRouter
import snowflake.connector
from config_manager import get_snowflake_config

router = APIRouter()

@router.post("/test-snowflake")
async def test_snowflake():
    """Test Snowflake connection with current config.json values."""
    cfg = get_snowflake_config()
    if not cfg.get("account") or not cfg.get("user"):
        return {"success": False, "message": "Snowflake account and user are required."}
    
    try:
        private_key = cfg.get("private_key", "")
        pkb = None
        if private_key:
            from cryptography.hazmat.primitives import serialization
            from cryptography.hazmat.backends import default_backend
            p_key = serialization.load_pem_private_key(
                private_key.encode('utf-8'),
                password=None,
                backend=default_backend()
            )
            pkb = p_key.private_bytes(
                encoding=serialization.Encoding.DER,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            )

        conn = snowflake.connector.connect(
            account=cfg["account"],
            user=cfg["user"],
            private_key=pkb,
            database=cfg.get("database"),
            schema=cfg.get("schema"),
            warehouse=cfg.get("warehouse"),
            role=cfg.get("role") or None,
            login_timeout=15,
        )
        cursor = conn.cursor()
        cursor.execute("SELECT CURRENT_VERSION()")
        version = cursor.fetchone()[0]
        cursor.close()
        conn.close()
        return {"success": True, "message": f"Connected to Snowflake (v{version})"}
    except Exception as e:
        return {"success": False, "message": str(e)}
