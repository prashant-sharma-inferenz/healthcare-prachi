import snowflake.connector
import os
import logging

logger = logging.getLogger(__name__)

_connection = None


def get_connection():
    """Get or create a Snowflake connection using .env config."""
    global _connection
    if _connection and not _connection.is_closed():
        return _connection

    try:
        _connection = snowflake.connector.connect(
            account=os.environ.get("SNOWFLAKE_ACCOUNT"),
            user=os.environ.get("SNOWFLAKE_USER"),
            password=os.environ.get("SNOWFLAKE_PASSWORD"),
            database=os.environ.get("SNOWFLAKE_DATABASE"),
            schema=os.environ.get("SNOWFLAKE_SCHEMA"),
            warehouse=os.environ.get("SNOWFLAKE_WAREHOUSE"),
            role=os.environ.get("SNOWFLAKE_ROLE"),
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
        logger.info("Snowflake connection closed")


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


def execute_many(query: str, params_list: list):
    """Execute a query with multiple parameter sets."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.executemany(query, params_list)
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
