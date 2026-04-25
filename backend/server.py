from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Query
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Any
import uuid
from datetime import datetime, timezone
import boto3
from botocore.exceptions import ClientError, NoCredentialsError
import snowflake.connector
from urllib.parse import urlparse

from database import get_connection, close_connection, reset_connection, execute_query, init_tables
from config_manager import (
    load_config, save_config, get_config_for_display,
    get_s3_config, get_storage_config, get_snowflake_config
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')


# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ─── AWS S3 Functions ────────────────────────────────────────────────────────

def get_s3_client():
    """Create S3 client from config.json."""
    cfg = get_s3_config()
    if not cfg.get("access_key_id") or not cfg.get("secret_access_key"):
        raise ConnectionError("AWS S3 not configured. Please update settings.")
    return boto3.client(
        "s3",
        aws_access_key_id=cfg["access_key_id"],
        aws_secret_access_key=cfg["secret_access_key"],
        region_name=cfg.get("region", "us-east-1"),
    )



def s3_upload(path: str, data: bytes, content_type: str) -> dict:
    """Upload file to S3. Returns dict with path and size."""
    """Upload file to S3. Returns dict with path, size, and full URL."""
    
    cfg = get_s3_config()
    client = get_s3_client()
    client.put_object(
        Bucket=cfg["bucket_name"],
        Key=path,
        Body=data,
        ContentType=content_type,
    )
    region = cfg.get("region")  # make sure region is in your config
    bucket = cfg["bucket_name"]
    file_url = f"https://{bucket}.s3.{region}.amazonaws.com/{path}"
    return {
        "path": file_url,
        "size": len(data)
    }


def s3_download(path: str) -> tuple:
    """Download file from S3. Returns (bytes, content_type)."""
    cfg = get_s3_config()
    client = get_s3_client()
    
    if path.startswith("http"):
        try:
            parsed = urlparse(path)
            path = parsed.path.lstrip('/')
        except Exception as e:
            logger.error(f"Error parsing S3 URL: {e}")
            
    obj = client.get_object(Bucket=cfg["bucket_name"], Key=path)
    return obj["Body"].read(), obj.get("ContentType", "application/octet-stream")


def build_storage_path(referral_id: str, filename: str) -> str:
    """Build S3 key using configurable format from config.json."""
    cfg = get_s3_config()
    stor = get_storage_config()
    ext = filename.rsplit(".", 1)[-1] if "." in filename else "bin"
    base = cfg.get("base_folder_path", "hospice-intake")
    folder_fmt = stor.get("folder_format", "referrals/{referral_id}")
    folder = folder_fmt.format(referral_id=referral_id)
    return f"{base}/{folder}/{uuid.uuid4()}.{ext}"


# ─── Pydantic Models ────────────────────────────────────────────────────────

class ReferralCreate(BaseModel):
    patient_name: str
    referral_source: str

class ReferralOut(BaseModel):
    id: str
    patient_name: str
    referral_source: str
    status: str
    created_at: str
    notes: Optional[Any]
    is_eligible: Optional[str] = Field(default=None, description="Eligibility status: true, false, or unknown")

class Metrics(BaseModel):
    total_referrals: int
    total_pending_admission: int
    conversion_percentage: float
    total_non_admit: int
    total_eligible: int
    total_non_eligible: int
    total_null_eligible: int

class ActivityCreate(BaseModel):
    activity_type: str
    date_time: str
    notes: str

class ActivityOut(BaseModel):
    id: str
    referral_id: str
    activity_type: str
    date_time: str
    notes: str
    created_at: str

class FileOut(BaseModel):
    id: str
    referral_id: Optional[str] = None
    storage_path: str
    original_filename: str
    content_type: Optional[str] = None
    size: Optional[int] = None
    notes: str = ""
    tags: str = ""
    is_deleted: bool = False
    created_at: str

class FileUpdate(BaseModel):
    notes: Optional[str] = None
    tags: Optional[str] = None

class SettingsInput(BaseModel):
    snowflake: dict
    aws_s3: dict
    storage: dict
    automation: dict


# ─── Helpers ─────────────────────────────────────────────────────────────────

def row_to_dict(row: dict) -> dict:
    result = {}
    for k, v in row.items():
        key = k.lower()
        if isinstance(v, datetime):
            result[key] = v.isoformat()
        elif isinstance(v, bool):
            result[key] = v
        else:
            result[key] = v
    return result


# ─── Settings API ────────────────────────────────────────────────────────────

@api_router.get("/settings")
async def get_settings():
    """Return current config with sensitive fields masked."""
    return get_config_for_display()


@api_router.put("/settings")
async def update_settings(body: SettingsInput):
    """Save new settings to config.json."""
    try:
        current = load_config()

        # For masked/blank passwords keep the old value
        new_cfg = body.dict()
        if "****" in new_cfg["snowflake"].get("password", "") or not new_cfg["snowflake"].get("password"):
            new_cfg["snowflake"]["password"] = current["snowflake"]["password"]
        if "****" in new_cfg["aws_s3"].get("secret_access_key", "") or not new_cfg["aws_s3"].get("secret_access_key"):
            new_cfg["aws_s3"]["secret_access_key"] = current["aws_s3"]["secret_access_key"]
        if "****" in new_cfg["aws_s3"].get("access_key_id", "") or not new_cfg["aws_s3"].get("access_key_id"):
            new_cfg["aws_s3"]["access_key_id"] = current["aws_s3"]["access_key_id"]
        
        if "****" in new_cfg["automation"].get("admin_password", "") or not new_cfg["automation"].get("admin_password"):
            new_cfg["automation"]["admin_password"] = current.get("automation", {}).get("admin_password", "")

        save_config(new_cfg)

        # Reset Snowflake connection so next call picks up new config
        reset_connection()

        return {"message": "Settings saved successfully"}
    except Exception as e:
        logger.error(f"Error saving settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/settings/test-snowflake")
async def test_snowflake():
    """Test Snowflake connection with current config.json values."""
    cfg = get_snowflake_config()
    if not cfg.get("account") or not cfg.get("user"):
        return {"success": False, "message": "Snowflake account and user are required."}
    try:
        conn = snowflake.connector.connect(
            account=cfg["account"],
            user=cfg["user"],
            password=cfg["password"],
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


@api_router.post("/settings/test-s3")
async def test_s3():
    """Test AWS S3 connection with current config.json values."""
    cfg = get_s3_config()
    if not cfg.get("access_key_id") or not cfg.get("bucket_name"):
        return {"success": False, "message": "AWS Access Key ID and Bucket Name are required."}
    try:
        client = boto3.client(
            "s3",
            aws_access_key_id=cfg["access_key_id"],
            aws_secret_access_key=cfg["secret_access_key"],
            region_name=cfg.get("region", "us-east-1"),
        )
        client.head_bucket(Bucket=cfg["bucket_name"])
        return {"success": True, "message": f"Connected to S3 bucket '{cfg['bucket_name']}'"}
    except NoCredentialsError:
        return {"success": False, "message": "Invalid AWS credentials."}
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code == "404":
            return {"success": False, "message": f"Bucket '{cfg['bucket_name']}' does not exist."}
        elif code == "403":
            return {"success": False, "message": "Access denied. Check your AWS credentials and bucket policy."}
        return {"success": False, "message": str(e)}
    except Exception as e:
        return {"success": False, "message": str(e)}


# ─── Core API Routes ─────────────────────────────────────────────────────────

@api_router.get("/")
async def root():
    return {"message": "Hospice Intake API"}


@api_router.get("/metrics", response_model=Metrics)
async def get_metrics():
    try:
        total = execute_query("SELECT COUNT(*) AS cnt FROM referrals", fetch=True)
        
        pending = execute_query("SELECT COUNT(*) AS cnt FROM referrals WHERE status = 'pending'", fetch=True)
        
        admitted = execute_query("SELECT COUNT(*) AS cnt FROM referrals WHERE status = 'admitted'", fetch=True)
        
        non_admit = execute_query("SELECT COUNT(*) AS cnt FROM referrals WHERE status = 'non_admit'", fetch=True)

        total_eligible = execute_query("SELECT COUNT(*) AS cnt FROM referrals WHERE is_eligible = 'Eligible'", fetch=True)

        total_non_eligible = execute_query("SELECT COUNT(*) AS cnt FROM referrals WHERE is_eligible = 'Ineligible'", fetch=True)
        
        total_null_eligible = execute_query("SELECT COUNT(*) AS cnt FROM referrals WHERE is_eligible IS NULL", fetch=True)

        total_count = total[0]["CNT"] if total else 0
        admitted_count = admitted[0]["CNT"] if admitted else 0
        pending_count = pending[0]["CNT"] if pending else 0
        non_admit_count = non_admit[0]["CNT"] if non_admit else 0
        total_eligible = total_eligible[0]["CNT"] if total_eligible else 0
        total_non_eligible = total_non_eligible[0]["CNT"] if total_non_eligible else 0
        total_null_eligible = total_null_eligible[0]["CNT"] if total_null_eligible else 0

        conversion = round((admitted_count / total_count) * 100, 1) if total_count > 0 else 0.0

        return Metrics(
            total_referrals=total_count,
            total_pending_admission=pending_count,
            conversion_percentage=conversion,
            total_non_admit=non_admit_count,
            total_eligible=total_eligible,
            total_non_eligible=total_non_eligible,
            total_null_eligible=total_null_eligible
        )
    except Exception as e:
        logger.error(f"Error fetching metrics: {e}")
        raise HTTPException(status_code=500, detail="Error fetching metrics")


@api_router.get("/referrals", response_model=List[ReferralOut])
async def get_referrals(status: Optional[str] = None):
    try:
        if status:
            rows = execute_query(
                "SELECT id, patient_name, referral_source, status, created_at, notes, IS_ELIGIBLE FROM referrals WHERE status = %s ORDER BY created_at DESC",
                (status,), fetch=True
            )
        else:
            rows = execute_query(
                "SELECT id, patient_name, referral_source, status, created_at,  notes, IS_ELIGIBLE FROM referrals ORDER BY created_at DESC",
                fetch=True
            )

        response = [row_to_dict(r) for r in (rows or [])]
        return response

    except Exception as e:
        logger.error(f"Error fetching referrals: {e}")
        raise HTTPException(status_code=500, detail="Error fetching referrals")


@api_router.post("/referrals", response_model=ReferralOut)
async def create_referral(body: ReferralCreate):
    try:
        ref_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        execute_query(
            "INSERT INTO referrals (id, patient_name, referral_source, status, created_at) VALUES (%s, %s, %s, 'pending', %s)",
            (ref_id, body.patient_name, body.referral_source, now)
        )
        return ReferralOut(
            id=ref_id, patient_name=body.patient_name,
            referral_source=body.referral_source, status="pending", created_at=now, notes = {}
        )
    except Exception as e:
        logger.error(f"Error creating referral: {e}")
        raise HTTPException(status_code=500, detail="Error creating referral")


# ─── Activities ──────────────────────────────────────────────────────────────

@api_router.post("/referrals/{referral_id}/activities", response_model=ActivityOut)
async def create_activity(referral_id: str, body: ActivityCreate):
    try:
        ref = execute_query("SELECT id FROM referrals WHERE id = %s", (referral_id,), fetch=True)
        if not ref:
            raise HTTPException(status_code=404, detail="Referral not found")
        act_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        execute_query(
            "INSERT INTO activities (id, referral_id, activity_type, date_time, notes, created_at) VALUES (%s, %s, %s, %s, %s, %s)",
            (act_id, referral_id, body.activity_type, body.date_time, body.notes, now)
        )
        return ActivityOut(
            id=act_id, referral_id=referral_id, activity_type=body.activity_type,
            date_time=body.date_time, notes=body.notes, created_at=now,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating activity: {e}")
        raise HTTPException(status_code=500, detail="Error creating activity")


@api_router.get("/referrals/{referral_id}/activities", response_model=List[ActivityOut])
async def get_activities(referral_id: str):
    try:
        rows = execute_query(
            "SELECT id, referral_id, activity_type, date_time, notes, created_at FROM activities WHERE referral_id = %s ORDER BY date_time DESC",
            (referral_id,), fetch=True
        )
        return [row_to_dict(r) for r in (rows or [])]
    except Exception as e:
        logger.error(f"Error fetching activities: {e}")
        raise HTTPException(status_code=500, detail="Error fetching activities")


# ─── File Upload & Document Management ───────────────────────────────────────

@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...), referral_id: str = Query(None)):
    try:
        stor = get_storage_config()
        allowed = [t.strip() for t in stor.get("allowed_file_types", "pdf,doc,docx").split(",")]
        max_mb = stor.get("max_file_size_mb", 50)

        ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
        if ext and ext not in allowed:
            raise HTTPException(status_code=400, detail=f"File type .{ext} not allowed.")

        data = await file.read()
        if len(data) > max_mb * 1024 * 1024:
            raise HTTPException(status_code=400, detail=f"File exceeds max size of {max_mb}MB")

        path = build_storage_path(referral_id or "unlinked", file.filename)
        result = s3_upload(path, data, file.content_type or "application/octet-stream")

        file_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        execute_query(
            "INSERT INTO files (id, referral_id, storage_path, original_filename, content_type, size, notes, tags, is_deleted, created_at) VALUES (%s, %s, %s, %s, %s, %s, '', '', FALSE, %s)",
            (file_id, referral_id, result["path"], file.filename, file.content_type or "application/octet-stream", result["size"], now)
        )

        return {"id": file_id, "filename": file.filename, "path": result["path"], "size": result["size"]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading file: {e}")
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")


@api_router.get("/referrals/{referral_id}/documents", response_model=List[FileOut])
async def get_documents(referral_id: str):
    try:
        rows = execute_query(
            "SELECT id, referral_id, storage_path, original_filename, content_type, size, notes, tags, is_deleted, created_at FROM files WHERE referral_id = %s AND is_deleted = FALSE ORDER BY created_at DESC",
            (referral_id,), fetch=True
        )
        return [row_to_dict(r) for r in (rows or [])]
    except Exception as e:
        logger.error(f"Error fetching documents: {e}")
        raise HTTPException(status_code=500, detail="Error fetching documents")


@api_router.patch("/files/{file_id}", response_model=FileOut)
async def update_file(file_id: str, body: FileUpdate):
    try:
        existing = execute_query("SELECT id FROM files WHERE id = %s AND is_deleted = FALSE", (file_id,), fetch=True)
        if not existing:
            raise HTTPException(status_code=404, detail="File not found")

        updates, params = [], []
        if body.notes is not None:
            updates.append("notes = %s"); params.append(body.notes)
        if body.tags is not None:
            updates.append("tags = %s"); params.append(body.tags)
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")

        params.append(file_id)
        execute_query(f"UPDATE files SET {', '.join(updates)} WHERE id = %s", tuple(params))

        row = execute_query(
            "SELECT id, referral_id, storage_path, original_filename, content_type, size, notes, tags, is_deleted, created_at FROM files WHERE id = %s",
            (file_id,), fetch=True
        )
        return row_to_dict(row[0])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating file: {e}")
        raise HTTPException(status_code=500, detail="Error updating file")


@api_router.delete("/files/{file_id}")
async def delete_file(file_id: str):
    try:
        existing = execute_query("SELECT id FROM files WHERE id = %s AND is_deleted = FALSE", (file_id,), fetch=True)
        if not existing:
            raise HTTPException(status_code=404, detail="File not found")
        execute_query("UPDATE files SET is_deleted = TRUE WHERE id = %s", (file_id,))
        return {"message": "File deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting file: {e}")
        raise HTTPException(status_code=500, detail="Error deleting file")


@api_router.get("/files/{file_path:path}")
async def download_file(file_path: str):
    try:
        # Try finding by exact match first, then by filename suffix
        record = execute_query(
            "SELECT storage_path, content_type FROM files WHERE (storage_path = %s OR storage_path LIKE '%%' || %s) AND is_deleted = FALSE",
            (file_path, file_path), fetch=True
        )
        
        if not record:
            raise HTTPException(status_code=404, detail="File not found")
            
        # If multiple matches (unlikely with UUIDs), take the first one
        full_storage_path = record[0]["STORAGE_PATH"]
        data, content_type = s3_download(full_storage_path)
        
        # Use content type from DB if available, else from S3
        final_content_type = record[0].get("CONTENT_TYPE") or content_type
        return Response(content=data, media_type=final_content_type)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading file: {e}")
        raise HTTPException(status_code=500, detail="Error downloading file")


# ─── App Lifecycle ───────────────────────────────────────────────────────────

app.include_router(api_router)

allow_origins = ["https://hospicesolution.caregence.ai", "http://localhost:3000", "http://hospicesolution.caregence.ai"]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    try:
        init_tables()
        logger.info("Snowflake tables ready")
    except Exception as e:
        logger.error(f"Snowflake init skipped: {e} — configure via Settings page.")


@app.on_event("shutdown")
async def shutdown():
    close_connection()