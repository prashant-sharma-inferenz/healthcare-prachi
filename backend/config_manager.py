import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

CONFIG_PATH = Path(__file__).parent / "config.json"

DEFAULT_CONFIG = {
    "snowflake": {
        "account": "",
        "user": "",
        "password": "",
        "database": "",
        "schema": "",
        "warehouse": "",
        "role": ""
    },
    "aws_s3": {
        "access_key_id": "",
        "secret_access_key": "",
        "bucket_name": "",
        "region": "us-east-1",
        "base_folder_path": "hospice-intake"
    },
    "storage": {
        "folder_format": "referrals/{referral_id}",
        "max_file_size_mb": 50,
        "allowed_file_types": "pdf,doc,docx,png,jpg,jpeg,gif,webp,txt,csv,xls,xlsx"
    }
}


def load_config() -> dict:
    """Load config from config.json, creating with defaults if missing."""
    if not CONFIG_PATH.exists():
        save_config(DEFAULT_CONFIG)
        return DEFAULT_CONFIG.copy()
    try:
        with open(CONFIG_PATH, "r") as f:
            cfg = json.load(f)
        # Merge with defaults so new keys are always present
        merged = _deep_merge(DEFAULT_CONFIG, cfg)
        return merged
    except Exception as e:
        logger.error(f"Failed to load config.json: {e}")
        return DEFAULT_CONFIG.copy()


def save_config(config: dict):
    """Persist config to config.json."""
    try:
        with open(CONFIG_PATH, "w") as f:
            json.dump(config, f, indent=2)
        logger.info("Config saved to config.json")
    except Exception as e:
        logger.error(f"Failed to save config.json: {e}")
        raise


def get_snowflake_config() -> dict:
    return load_config().get("snowflake", DEFAULT_CONFIG["snowflake"])


def get_s3_config() -> dict:
    return load_config().get("aws_s3", DEFAULT_CONFIG["aws_s3"])


def get_storage_config() -> dict:
    return load_config().get("storage", DEFAULT_CONFIG["storage"])


def mask_secret(value: str) -> str:
    """Mask sensitive values for display, showing first 4 and last 2 chars."""
    if not value or len(value) < 8:
        return "****" if value else ""
    return value[:4] + "*" * (len(value) - 6) + value[-2:]


def get_config_for_display() -> dict:
    """Return config with sensitive fields masked."""
    cfg = load_config()
    display = {
        "snowflake": {
            "account": cfg["snowflake"]["account"],
            "user": cfg["snowflake"]["user"],
            "password": mask_secret(cfg["snowflake"]["password"]),
            "database": cfg["snowflake"]["database"],
            "schema": cfg["snowflake"]["schema"],
            "warehouse": cfg["snowflake"]["warehouse"],
            "role": cfg["snowflake"]["role"],
        },
        "aws_s3": {
            "access_key_id": mask_secret(cfg["aws_s3"]["access_key_id"]),
            "secret_access_key": mask_secret(cfg["aws_s3"]["secret_access_key"]),
            "bucket_name": cfg["aws_s3"]["bucket_name"],
            "region": cfg["aws_s3"]["region"],
            "base_folder_path": cfg["aws_s3"]["base_folder_path"],
        },
        "storage": cfg.get("storage", DEFAULT_CONFIG["storage"]),
    }
    return display


def _deep_merge(base: dict, override: dict) -> dict:
    """Merge override into base recursively."""
    result = base.copy()
    for k, v in override.items():
        if k in result and isinstance(result[k], dict) and isinstance(v, dict):
            result[k] = _deep_merge(result[k], v)
        else:
            result[k] = v
    return result
