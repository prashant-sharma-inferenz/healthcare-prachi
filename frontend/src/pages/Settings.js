import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Database, Cloud, CheckCircle2, XCircle, Loader2, Save, FolderCog } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SectionCard = ({ icon: Icon, title, children }) => (
  <div className="bg-card rounded-lg border border-border shadow-sm">
    <div className="p-5 border-b border-border flex items-center gap-3">
      <div className="p-2 bg-primary/10 rounded-lg">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <h2 className="text-lg font-medium text-foreground">{title}</h2>
    </div>
    <div className="p-5 space-y-4">{children}</div>
  </div>
);

const FieldRow = ({ label, children, hint }) => (
  <div className="space-y-1.5">
    <Label className="text-sm font-medium">{label}</Label>
    {children}
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
);

const TestBadge = ({ result }) => {
  if (!result) return null;
  return (
    <div
      data-testid={result.success ? "test-success-badge" : "test-failure-badge"}
      className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg mt-3 ${
        result.success
          ? "bg-green-50 text-green-700 border border-green-200"
          : "bg-red-50 text-red-700 border border-red-200"
      }`}
    >
      {result.success ? (
        <CheckCircle2 className="w-4 h-4" />
      ) : (
        <XCircle className="w-4 h-4" />
      )}
      <span>{result.message}</span>
    </div>
  );
};

const Settings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingSnowflake, setTestingSnowflake] = useState(false);
  const [testingS3, setTestingS3] = useState(false);
  const [snowflakeResult, setSnowflakeResult] = useState(null);
  const [s3Result, setS3Result] = useState(null);

  // Snowflake fields
  const [sfAccount, setSfAccount] = useState("");
  const [sfUser, setSfUser] = useState("");
  const [sfPassword, setSfPassword] = useState("");
  const [sfDatabase, setSfDatabase] = useState("");
  const [sfSchema, setSfSchema] = useState("");
  const [sfWarehouse, setSfWarehouse] = useState("");
  const [sfRole, setSfRole] = useState("");

  // AWS S3 fields
  const [s3AccessKey, setS3AccessKey] = useState("");
  const [s3SecretKey, setS3SecretKey] = useState("");
  const [s3Bucket, setS3Bucket] = useState("");
  const [s3Region, setS3Region] = useState("us-east-1");
  const [s3BasePath, setS3BasePath] = useState("hospice-intake");

  // Storage fields
  const [folderFormat, setFolderFormat] = useState("referrals/{referral_id}");
  const [maxFileSize, setMaxFileSize] = useState("50");
  const [allowedTypes, setAllowedTypes] = useState(
    "pdf,doc,docx,png,jpg,jpeg,gif,webp,txt,csv,xls,xlsx"
  );

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/settings`);
      const data = res.data;

      // Snowflake
      setSfAccount(data.snowflake?.account || "");
      setSfUser(data.snowflake?.user || "");
      setSfPassword(data.snowflake?.password || "");
      setSfDatabase(data.snowflake?.database || "");
      setSfSchema(data.snowflake?.schema || "");
      setSfWarehouse(data.snowflake?.warehouse || "");
      setSfRole(data.snowflake?.role || "");

      // AWS S3
      setS3AccessKey(data.aws_s3?.access_key_id || "");
      setS3SecretKey(data.aws_s3?.secret_access_key || "");
      setS3Bucket(data.aws_s3?.bucket_name || "");
      setS3Region(data.aws_s3?.region || "us-east-1");
      setS3BasePath(data.aws_s3?.base_folder_path || "hospice-intake");

      // Storage
      setFolderFormat(data.storage?.folder_format || "referrals/{referral_id}");
      setMaxFileSize(String(data.storage?.max_file_size_mb || 50));
      setAllowedTypes(data.storage?.allowed_file_types || "pdf,doc,docx,png,jpg,jpeg");
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await axios.put(`${API}/settings`, {
        snowflake: {
          account: sfAccount,
          user: sfUser,
          password: sfPassword,
          database: sfDatabase,
          schema: sfSchema,
          warehouse: sfWarehouse,
          role: sfRole,
        },
        aws_s3: {
          access_key_id: s3AccessKey,
          secret_access_key: s3SecretKey,
          bucket_name: s3Bucket,
          region: s3Region,
          base_folder_path: s3BasePath,
        },
        storage: {
          folder_format: folderFormat,
          max_file_size_mb: parseInt(maxFileSize, 10) || 50,
          allowed_file_types: allowedTypes,
        },
      });
      toast.success("Settings saved successfully");
      setSnowflakeResult(null);
      setS3Result(null);
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleTestSnowflake = async () => {
    try {
      setTestingSnowflake(true);
      setSnowflakeResult(null);
      // Save first so the backend tests with latest values
      await axios.put(`${API}/settings`, {
        snowflake: {
          account: sfAccount, user: sfUser, password: sfPassword,
          database: sfDatabase, schema: sfSchema, warehouse: sfWarehouse, role: sfRole,
        },
        aws_s3: {
          access_key_id: s3AccessKey, secret_access_key: s3SecretKey,
          bucket_name: s3Bucket, region: s3Region, base_folder_path: s3BasePath,
        },
        storage: {
          folder_format: folderFormat,
          max_file_size_mb: parseInt(maxFileSize, 10) || 50,
          allowed_file_types: allowedTypes,
        },
      });
      const res = await axios.post(`${API}/settings/test-snowflake`);
      setSnowflakeResult(res.data);
    } catch (error) {
      setSnowflakeResult({ success: false, message: "Request failed" });
    } finally {
      setTestingSnowflake(false);
    }
  };

  const handleTestS3 = async () => {
    try {
      setTestingS3(true);
      setS3Result(null);
      // Save first
      await axios.put(`${API}/settings`, {
        snowflake: {
          account: sfAccount, user: sfUser, password: sfPassword,
          database: sfDatabase, schema: sfSchema, warehouse: sfWarehouse, role: sfRole,
        },
        aws_s3: {
          access_key_id: s3AccessKey, secret_access_key: s3SecretKey,
          bucket_name: s3Bucket, region: s3Region, base_folder_path: s3BasePath,
        },
        storage: {
          folder_format: folderFormat,
          max_file_size_mb: parseInt(maxFileSize, 10) || 50,
          allowed_file_types: allowedTypes,
        },
      });
      const res = await axios.post(`${API}/settings/test-s3`);
      setS3Result(res.data);
    } catch (error) {
      setS3Result({ success: false, message: "Request failed" });
    } finally {
      setTestingS3(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading settings...
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8" data-testid="settings-page">
      <div>
        <h1 className="text-3xl md:text-4xl font-semibold text-foreground tracking-tight">
          Settings
        </h1>
        <p className="text-muted-foreground mt-2">
          Configure database and storage connections
        </p>
      </div>

      {/* ── Snowflake ─────────────────────── */}
      <SectionCard icon={Database} title="Snowflake Database">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldRow label="Account" hint="e.g. xy12345.us-east-1">
            <Input
              data-testid="sf-account"
              value={sfAccount}
              onChange={(e) => setSfAccount(e.target.value)}
              placeholder="xy12345.us-east-1"
            />
          </FieldRow>
          <FieldRow label="Username">
            <Input
              data-testid="sf-user"
              value={sfUser}
              onChange={(e) => setSfUser(e.target.value)}
              placeholder="SNOWFLAKE_USER"
            />
          </FieldRow>
          <FieldRow label="Password">
            <Input
              data-testid="sf-password"
              type="password"
              value={sfPassword}
              onChange={(e) => setSfPassword(e.target.value)}
              placeholder="Enter password"
            />
          </FieldRow>
          <FieldRow label="Database">
            <Input
              data-testid="sf-database"
              value={sfDatabase}
              onChange={(e) => setSfDatabase(e.target.value)}
              placeholder="MY_DATABASE"
            />
          </FieldRow>
          <FieldRow label="Schema">
            <Input
              data-testid="sf-schema"
              value={sfSchema}
              onChange={(e) => setSfSchema(e.target.value)}
              placeholder="PUBLIC"
            />
          </FieldRow>
          <FieldRow label="Warehouse">
            <Input
              data-testid="sf-warehouse"
              value={sfWarehouse}
              onChange={(e) => setSfWarehouse(e.target.value)}
              placeholder="COMPUTE_WH"
            />
          </FieldRow>
          <FieldRow label="Role" hint="Optional">
            <Input
              data-testid="sf-role"
              value={sfRole}
              onChange={(e) => setSfRole(e.target.value)}
              placeholder="ACCOUNTADMIN"
            />
          </FieldRow>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            data-testid="test-snowflake-btn"
            disabled={testingSnowflake}
            onClick={handleTestSnowflake}
          >
            {testingSnowflake ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Testing...</>
            ) : (
              "Test Connection"
            )}
          </Button>
        </div>
        <TestBadge result={snowflakeResult} />
      </SectionCard>

      {/* ── AWS S3 ─────────────────────── */}
      <SectionCard icon={Cloud} title="AWS S3 Storage">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldRow label="Access Key ID">
            <Input
              data-testid="s3-access-key"
              value={s3AccessKey}
              onChange={(e) => setS3AccessKey(e.target.value)}
              placeholder="AKIA..."
            />
          </FieldRow>
          <FieldRow label="Secret Access Key">
            <Input
              data-testid="s3-secret-key"
              type="password"
              value={s3SecretKey}
              onChange={(e) => setS3SecretKey(e.target.value)}
              placeholder="Enter secret key"
            />
          </FieldRow>
          <FieldRow label="Bucket Name">
            <Input
              data-testid="s3-bucket"
              value={s3Bucket}
              onChange={(e) => setS3Bucket(e.target.value)}
              placeholder="my-hospice-bucket"
            />
          </FieldRow>
          <FieldRow label="Region">
            <Select value={s3Region} onValueChange={setS3Region}>
              <SelectTrigger data-testid="s3-region-select">
                <SelectValue placeholder="Select region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
                <SelectItem value="us-east-2">US East (Ohio)</SelectItem>
                <SelectItem value="us-west-1">US West (N. California)</SelectItem>
                <SelectItem value="us-west-2">US West (Oregon)</SelectItem>
                <SelectItem value="eu-west-1">EU (Ireland)</SelectItem>
                <SelectItem value="eu-central-1">EU (Frankfurt)</SelectItem>
                <SelectItem value="ap-southeast-1">Asia Pacific (Singapore)</SelectItem>
                <SelectItem value="ap-northeast-1">Asia Pacific (Tokyo)</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Base Folder Path" hint="Root prefix for all uploads">
            <Input
              data-testid="s3-base-path"
              value={s3BasePath}
              onChange={(e) => setS3BasePath(e.target.value)}
              placeholder="hospice-intake"
            />
          </FieldRow>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            data-testid="test-s3-btn"
            disabled={testingS3}
            onClick={handleTestS3}
          >
            {testingS3 ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Testing...</>
            ) : (
              "Test Connection"
            )}
          </Button>
        </div>
        <TestBadge result={s3Result} />
      </SectionCard>

      {/* ── Storage Options ─────────────────────── */}
      <SectionCard icon={FolderCog} title="Storage Options">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldRow
            label="Folder Format"
            hint="Use {referral_id} as placeholder. e.g. referrals/{referral_id}"
          >
            <Input
              data-testid="storage-folder-format"
              value={folderFormat}
              onChange={(e) => setFolderFormat(e.target.value)}
              placeholder="referrals/{referral_id}"
            />
          </FieldRow>
          <FieldRow label="Max File Size (MB)">
            <Input
              data-testid="storage-max-size"
              type="number"
              value={maxFileSize}
              onChange={(e) => setMaxFileSize(e.target.value)}
              placeholder="50"
            />
          </FieldRow>
          <div className="md:col-span-2">
            <FieldRow label="Allowed File Types" hint="Comma-separated extensions">
              <Input
                data-testid="storage-allowed-types"
                value={allowedTypes}
                onChange={(e) => setAllowedTypes(e.target.value)}
                placeholder="pdf,doc,docx,png,jpg"
              />
            </FieldRow>
          </div>
        </div>
      </SectionCard>

      {/* ── Save ─────────────────────── */}
      <div className="flex gap-3 pb-8">
        <Button
          data-testid="save-settings-btn"
          disabled={saving}
          onClick={handleSave}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Saving...</>
          ) : (
            <><Save className="w-4 h-4 mr-1.5" /> Save All Settings</>
          )}
        </Button>
      </div>
    </div>
  );
};

export default Settings;
