import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  FileText,
  Download,
  Trash2,
  UploadCloud,
  X,
  Tag,
  StickyNote,
  Save,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DocumentsDialog = ({ open, onOpenChange, referral }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newFiles, setNewFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState(null);
  const [editNotes, setEditNotes] = useState({});
  const [editTags, setEditTags] = useState({});

  const fetchDocuments = useCallback(async () => {
    if (!referral) return;
    try {
      setLoading(true);
      const response = await axios.get(`${API}/referrals/${referral.id}/documents`);
      setDocuments(response.data);
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [referral]);

  useEffect(() => {
    if (open && referral) {
      fetchDocuments();
    }
  }, [open, referral, fetchDocuments]);

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
      setNewFiles((prev) => [...prev, ...Array.from(e.dataTransfer.files)]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setNewFiles((prev) => [...prev, ...Array.from(e.target.files)]);
    }
  };

  const removeNewFile = (index) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (newFiles.length === 0) return;
    try {
      setUploading(true);
      const promises = newFiles.map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        return axios.post(`${API}/upload?referral_id=${referral.id}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      });
      await Promise.all(promises);
      toast.success(`${newFiles.length} document(s) uploaded`);
      setNewFiles([]);
      fetchDocuments();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload documents");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fileId) => {
    try {
      await axios.delete(`${API}/files/${fileId}`);
      toast.success("Document deleted");
      fetchDocuments();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete document");
    }
  };

  const handleDownload = async (doc) => {
    try {
      const response = await axios.get(`${API}/files/${doc.storage_path}`, {
        responseType: "blob",
      });
      const blobUrl = URL.createObjectURL(response.data);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = doc.original_filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download document");
    }
  };

  const toggleExpand = (docId) => {
    if (expandedDoc === docId) {
      setExpandedDoc(null);
    } else {
      setExpandedDoc(docId);
      const doc = documents.find((d) => d.id === docId);
      if (doc) {
        setEditNotes((prev) => ({ ...prev, [docId]: doc.notes || "" }));
        setEditTags((prev) => ({ ...prev, [docId]: doc.tags || "" }));
      }
    }
  };

  const handleSaveMeta = async (docId) => {
    try {
      await axios.patch(`${API}/files/${docId}`, {
        notes: editNotes[docId] || "",
        tags: editTags[docId] || "",
      });
      toast.success("Document updated");
      fetchDocuments();
    } catch (error) {
      console.error("Update error:", error);
      toast.error("Failed to update document");
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  if (!referral) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="documents-dialog">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">Manage Documents</DialogTitle>
          <div className="pt-2 space-y-1">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Patient:</span> {referral.patient_name}
            </p>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Source:</span>{" "}
              <span className="capitalize">{referral.referral_source}</span>
            </p>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Upload Section */}
          <div className="bg-muted/30 rounded-lg border border-border p-4">
            <h3 className="text-lg font-medium mb-3">Upload Documents</h3>
            <div
              data-testid="doc-upload-zone"
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                dragActive
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
                id="doc-file-input"
                data-testid="doc-file-input"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <label htmlFor="doc-file-input" className="cursor-pointer">
                <UploadCloud className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-foreground font-medium mb-1">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">PDF, DOC, DOCX, images, or spreadsheets</p>
              </label>
            </div>

            {newFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                {newFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-card rounded border border-border"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{file.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({formatSize(file.size)})
                      </span>
                    </div>
                    <button onClick={() => removeNewFile(index)} className="p-1 hover:bg-destructive/10 rounded">
                      <X className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                ))}
                <Button
                  data-testid="upload-docs-btn"
                  disabled={uploading}
                  onClick={handleUpload}
                  className="mt-2"
                  size="sm"
                >
                  {uploading ? "Uploading..." : `Upload ${newFiles.length} file(s)`}
                </Button>
              </div>
            )}
          </div>

          {/* Existing Documents */}
          <div>
            <h3 className="text-lg font-medium mb-3">
              Documents{" "}
              <span className="text-sm text-muted-foreground font-normal">
                ({documents.length})
              </span>
            </h3>

            {loading ? (
              <div className="text-center py-6 text-muted-foreground">Loading documents...</div>
            ) : documents.length === 0 ? (
              <div
                className="text-center py-6 text-muted-foreground"
                data-testid="no-documents-message"
              >
                No documents uploaded yet.
              </div>
            ) : (
              <div className="space-y-2" data-testid="documents-list">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    data-testid={`document-item-${doc.id}`}
                    className="bg-card border border-border rounded-lg overflow-hidden"
                  >
                    {/* Document row */}
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {doc.original_filename}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatSize(doc.size)} &middot; {formatDate(doc.created_at)}
                            {doc.tags && (
                              <span className="ml-2">
                                <Tag className="w-3 h-3 inline mr-1" />
                                {doc.tags}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          data-testid={`download-doc-${doc.id}`}
                          onClick={() => handleDownload(doc)}
                          className="p-2 hover:bg-muted rounded-lg transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4 text-foreground" />
                        </button>
                        <button
                          data-testid={`expand-doc-${doc.id}`}
                          onClick={() => toggleExpand(doc.id)}
                          className="p-2 hover:bg-muted rounded-lg transition-colors"
                          title="Edit notes & tags"
                        >
                          {expandedDoc === doc.id ? (
                            <ChevronUp className="w-4 h-4 text-foreground" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-foreground" />
                          )}
                        </button>
                        <button
                          data-testid={`delete-doc-${doc.id}`}
                          onClick={() => handleDelete(doc.id)}
                          className="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded meta section */}
                    {expandedDoc === doc.id && (
                      <div className="border-t border-border p-4 bg-muted/20 space-y-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs flex items-center gap-1.5">
                            <StickyNote className="w-3.5 h-3.5" /> Notes
                          </Label>
                          <Textarea
                            data-testid={`doc-notes-${doc.id}`}
                            rows={2}
                            value={editNotes[doc.id] ?? doc.notes ?? ""}
                            onChange={(e) =>
                              setEditNotes((prev) => ({ ...prev, [doc.id]: e.target.value }))
                            }
                            placeholder="Add notes about this document..."
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5" /> Tags
                          </Label>
                          <Input
                            data-testid={`doc-tags-${doc.id}`}
                            value={editTags[doc.id] ?? doc.tags ?? ""}
                            onChange={(e) =>
                              setEditTags((prev) => ({ ...prev, [doc.id]: e.target.value }))
                            }
                            placeholder="e.g. medical-records, insurance, consent-form"
                          />
                        </div>
                        <Button
                          size="sm"
                          data-testid={`save-doc-meta-${doc.id}`}
                          onClick={() => handleSaveMeta(doc.id)}
                        >
                          <Save className="w-4 h-4 mr-1.5" /> Save
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentsDialog;
