from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import requests

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Object Storage Configuration
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get('EMERGENT_LLM_KEY')
APP_NAME = "hospice-intake"
storage_key = None

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Object Storage Functions
def init_storage():
    """Initialize storage and return reusable storage_key"""
    global storage_key
    if storage_key:
        return storage_key
    try:
        resp = requests.post(
            f"{STORAGE_URL}/init",
            json={"emergent_key": EMERGENT_KEY},
            timeout=30
        )
        resp.raise_for_status()
        storage_key = resp.json()["storage_key"]
        logger.info("Storage initialized successfully")
        return storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        raise

def put_object(path: str, data: bytes, content_type: str) -> dict:
    """Upload file to object storage"""
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120
    )
    resp.raise_for_status()
    return resp.json()

def get_object(path: str) -> tuple:
    """Download file from object storage"""
    key = init_storage()
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key},
        timeout=60
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

# Pydantic Models
class ReferralCreate(BaseModel):
    patient_name: str
    referral_source: str

class Referral(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    patient_name: str
    referral_source: str
    status: str = "pending"
    file_paths: List[str] = Field(default_factory=list)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class FileRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    storage_path: str
    original_filename: str
    content_type: str
    size: int
    referral_id: Optional[str] = None
    is_deleted: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class Metrics(BaseModel):
    total_referrals: int
    total_pending_admission: int
    conversion_percentage: float
    total_non_admit: int

# API Routes
@api_router.get("/")
async def root():
    return {"message": "Hospice Intake API"}

@api_router.get("/metrics", response_model=Metrics)
async def get_metrics():
    """Get dashboard metrics"""
    try:
        total_referrals = await db.referrals.count_documents({})
        total_pending = await db.referrals.count_documents({"status": "pending"})
        total_admitted = await db.referrals.count_documents({"status": "admitted"})
        total_non_admit = await db.referrals.count_documents({"status": "non_admit"})
        
        # Calculate conversion percentage
        conversion_percentage = 0.0
        if total_referrals > 0:
            conversion_percentage = round((total_admitted / total_referrals) * 100, 1)
        
        return Metrics(
            total_referrals=total_referrals,
            total_pending_admission=total_pending,
            conversion_percentage=conversion_percentage,
            total_non_admit=total_non_admit
        )
    except Exception as e:
        logger.error(f"Error fetching metrics: {e}")
        raise HTTPException(status_code=500, detail="Error fetching metrics")

@api_router.get("/referrals", response_model=List[Referral])
async def get_referrals(status: Optional[str] = None):
    """Get all referrals or filter by status"""
    try:
        query = {}
        if status:
            query["status"] = status
        
        referrals = await db.referrals.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
        return referrals
    except Exception as e:
        logger.error(f"Error fetching referrals: {e}")
        raise HTTPException(status_code=500, detail="Error fetching referrals")

@api_router.post("/referrals", response_model=Referral)
async def create_referral(referral_input: ReferralCreate):
    """Create a new referral"""
    try:
        referral = Referral(
            patient_name=referral_input.patient_name,
            referral_source=referral_input.referral_source
        )
        
        doc = referral.model_dump()
        await db.referrals.insert_one(doc)
        
        logger.info(f"Created referral: {referral.id}")
        return referral
    except Exception as e:
        logger.error(f"Error creating referral: {e}")
        raise HTTPException(status_code=500, detail="Error creating referral")

@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...), referral_id: str = None):
    """Upload a file to object storage"""
    try:
        # Read file data
        data = await file.read()
        
        # Generate unique path
        ext = file.filename.split(".")[-1] if "." in file.filename else "bin"
        file_id = str(uuid.uuid4())
        path = f"{APP_NAME}/referrals/{file_id}.{ext}"
        
        # Upload to object storage
        result = put_object(path, data, file.content_type or "application/octet-stream")
        
        # Store file record in database
        file_record = FileRecord(
            storage_path=result["path"],
            original_filename=file.filename,
            content_type=file.content_type or "application/octet-stream",
            size=result["size"],
            referral_id=referral_id
        )
        
        await db.files.insert_one(file_record.model_dump())
        
        # If referral_id provided, add file path to referral
        if referral_id:
            await db.referrals.update_one(
                {"id": referral_id},
                {"$push": {"file_paths": result["path"]}}
            )
        
        logger.info(f"Uploaded file: {file.filename} -> {result['path']}")
        return {
            "id": file_record.id,
            "filename": file.filename,
            "path": result["path"],
            "size": result["size"]
        }
    except Exception as e:
        logger.error(f"Error uploading file: {e}")
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")

@api_router.get("/files/{file_path:path}")
async def download_file(file_path: str):
    """Download a file from object storage"""
    try:
        # Get file record from database
        file_record = await db.files.find_one(
            {"storage_path": file_path, "is_deleted": False},
            {"_id": 0}
        )
        
        if not file_record:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Download from object storage
        data, content_type = get_object(file_path)
        
        return Response(
            content=data,
            media_type=file_record.get("content_type", content_type)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading file: {e}")
        raise HTTPException(status_code=500, detail="Error downloading file")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    """Initialize storage on startup"""
    try:
        init_storage()
        logger.info("Application started successfully")
    except Exception as e:
        logger.error(f"Startup failed: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
