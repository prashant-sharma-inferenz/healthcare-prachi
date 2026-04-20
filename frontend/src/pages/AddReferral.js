import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { UploadCloud, FileText, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AddReferral = () => {
  const navigate = useNavigate();
  const [patientName, setPatientName] = useState("");
  const [referralSource, setReferralSource] = useState("");
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files);
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!patientName.trim()) {
      toast.error("Please enter patient name");
      return;
    }

    if (!referralSource) {
      toast.error("Please select referral source");
      return;
    }

    try {
      setUploading(true);

      // Create referral first
      const referralResponse = await axios.post(`${API}/referrals`, {
        patient_name: patientName,
        referral_source: referralSource,
      });

      const referralId = referralResponse.data.id;

      // Upload files if any
      let s3Path = "";
      if (files.length > 0) {
        const uploadPromises = files.map(async (file) => {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("referral_id", referralId);

          return axios.post(`${API}/upload?referral_id=${referralId}`, formData, {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          });
        });

        const uploadResponses = await Promise.all(uploadPromises);
        // Get the S3 path from the first uploaded file
        if (uploadResponses.length > 0 && uploadResponses[0].data) {
          s3Path = uploadResponses[0].data.path;
        }
      }

      // Login to get token for workflow trigger
      try {
        const loginResponse = await axios.post("https://dev-api.caregence.ai/users/login", {
          email: process.env.REACT_APP_ADMIN_USERNAME,
          password: process.env.REACT_APP_ADMIN_PASSWORD
        });

        if (loginResponse.data?.success) {
          const accessToken = loginResponse.data.data.access_token;

          // Trigger the workflow
          await axios.post(
            "https://dev-api.caregence.ai/utility/start-workflow-trigger?workflow_id=ae17a001-612f-4870-824e-c24e17c33fc2",
            {
              referral_id: referralId
            },
            {
              headers: {
                Authorization: `Bearer ${accessToken}`
              }
            }
          );
          console.log("Workflow triggered successfully");
        }
      } catch (workflowErr) {
        console.error("Error triggering workflow:", workflowErr);
        // We don't necessarily want to block the user if the workflow trigger fails 
        // since the referral was already created in the main DB.
      }

      toast.success("Referral created successfully");
      navigate("/");
    } catch (error) {
      console.error("Error creating referral:", error);
      toast.error("Failed to create referral");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl" data-testid="add-referral-page">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-semibold text-foreground tracking-tight">
          Add New Referral
        </h1>
        <p className="text-muted-foreground mt-2">Enter patient information and upload documents</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-card rounded-lg border border-border p-6 shadow-sm space-y-6">
          {/* Patient Name */}
          <div className="space-y-2">
            <Label htmlFor="patient-name" className="text-sm font-medium">
              Patient Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="patient-name"
              data-testid="input-patient-name"
              type="text"
              placeholder="Enter patient name"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Referral Source */}
          <div className="space-y-2">
            <Label htmlFor="referral-source" className="text-sm font-medium">
              Referral Source <span className="text-destructive">*</span>
            </Label>
            <Select value={referralSource} onValueChange={setReferralSource}>
              <SelectTrigger data-testid="select-referral-source" className="w-full">
                <SelectValue placeholder="Select referral source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hospital" data-testid="option-hospital">
                  Hospital
                </SelectItem>
                <SelectItem value="physician" data-testid="option-physician">
                  Physician
                </SelectItem>
                <SelectItem value="internal referral" data-testid="option-internal">
                  Internal Referral
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* File Upload Zone */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Referral Package</Label>
            <div
              data-testid="file-upload-zone"
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragActive
                ? "border-primary bg-muted/50"
                : "border-border bg-muted/20 hover:bg-muted/50"
                }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                id="file-input"
                data-testid="file-input"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <label htmlFor="file-input" className="cursor-pointer">
                <UploadCloud className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-foreground font-medium mb-1">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">PDF, DOC, DOCX, or images</p>
              </label>
            </div>

            {/* Uploaded Files List */}
            {files.length > 0 && (
              <div className="mt-4 space-y-2" data-testid="uploaded-files-list">
                <p className="text-sm font-medium text-foreground">Uploaded Files:</p>
                <div className="space-y-2">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      data-testid={`file-item-${index}`}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        data-testid={`remove-file-${index}`}
                        onClick={() => removeFile(index)}
                        className="p-1 hover:bg-destructive/10 rounded transition-colors"
                      >
                        <X className="w-4 h-4 text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            type="submit"
            data-testid="submit-referral-btn"
            disabled={uploading}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {uploading ? "Creating..." : "Create Referral"}
          </Button>
          <Button
            type="button"
            variant="outline"
            data-testid="cancel-btn"
            onClick={() => navigate("/")}
            disabled={uploading}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AddReferral;
