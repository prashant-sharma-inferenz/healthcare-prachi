import snowflake.connector
import logging
from config_manager import get_snowflake_config

logger = logging.getLogger(__name__)

_connection = None


def get_connection():
    """Get or create a Snowflake connection using config.json."""
    global _connection
    if _connection and not _connection.is_closed():
        return _connection

    cfg = get_snowflake_config()

    if not cfg.get("account") or not cfg.get("user"):
        raise ConnectionError("Snowflake not configured. Please update settings.")

    try:
        _connection = snowflake.connector.connect(
            account=cfg["account"],
            user=cfg["user"],
            password=cfg["password"],
            database=cfg["database"],
            schema=cfg["schema"],
            warehouse=cfg["warehouse"],
            role=cfg.get("role") or None,
        )
        logger.info("Snowflake connection established")
        return _connection
    except Exception as e:
        logger.error(f"Snowflake connection failed: {e}")
        raise


def close_connection():
    """Close the Snowflake connection."""
    global _connection
    if _connection and not _connection.is_closed():
        _connection.close()
        _connection = None
        logger.info("Snowflake connection closed")


def reset_connection():
    """Force close and reset so next call reconnects with fresh config."""
    close_connection()


def execute_query(query: str, params: tuple = None, fetch: bool = False):
    """Execute a SQL query. Returns rows if fetch=True."""
    conn = get_connection()
    cursor = conn.cursor(snowflake.connector.DictCursor)
    try:
        cursor.execute(query, params)
        if fetch:
            return cursor.fetchall()
        return None
    finally:
        cursor.close()


def init_tables():
    """Create tables if they don't exist."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS referrals (
                id VARCHAR(36) PRIMARY KEY,
                patient_name VARCHAR(500) NOT NULL,
                referral_source VARCHAR(100) NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP_TZ DEFAULT CURRENT_TIMESTAMP()
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS activities (
                id VARCHAR(36) PRIMARY KEY,
                referral_id VARCHAR(36) NOT NULL,
                activity_type VARCHAR(100) NOT NULL,
                date_time TIMESTAMP_TZ NOT NULL,
                notes TEXT,
                created_at TIMESTAMP_TZ DEFAULT CURRENT_TIMESTAMP(),
                FOREIGN KEY (referral_id) REFERENCES referrals(id)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS files (
                id VARCHAR(36) PRIMARY KEY,
                referral_id VARCHAR(36),
                storage_path VARCHAR(1000) NOT NULL,
                original_filename VARCHAR(500) NOT NULL,
                content_type VARCHAR(200),
                size INTEGER,
                notes TEXT DEFAULT '',
                tags VARCHAR(1000) DEFAULT '',
                is_deleted BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP_TZ DEFAULT CURRENT_TIMESTAMP(),
                FOREIGN KEY (referral_id) REFERENCES referrals(id)
            )
        """)

        logger.info("Snowflake tables initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize tables: {e}")
        raise
    finally:
        cursor.close()
