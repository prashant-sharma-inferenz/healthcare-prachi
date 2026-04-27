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
  AlertCircle,
  CheckCircle2,
  Activity,
  ClipboardCheck,
  ExternalLink,
  Info
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";

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
  const [fullReferral, setFullReferral] = useState(null);
  const [fetchingReferral, setFetchingReferral] = useState(false);


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

  const fetchFullReferral = useCallback(async () => {
    if (!referral) return;
    try {
      setFetchingReferral(true);
      const response = await axios.get(`${API}/referrals/${referral.id}`);
      setFullReferral(response.data);
    } catch (error) {
      console.error("Error fetching detailed referral:", error);
    } finally {
      setFetchingReferral(false);
    }
  }, [referral]);

  useEffect(() => {
    if (open && referral) {
      fetchDocuments();
      fetchFullReferral();
    }
  }, [open, referral, fetchDocuments, fetchFullReferral]);


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
      console.log('doc.storage_path', doc.storage_path);

      // Extract only the filename from the storage_path
      const parts = doc.storage_path.split('/');
      const fileName = parts[parts.length - 1];

      const response = await axios.get(`${API}/files/${fileName}`, {
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

  const renderOCRContent = () => {
    if (fetchingReferral) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm text-muted-foreground">Loading clinical report...</p>
        </div>
      );
    }

    const data = fullReferral?.notes;
    if (!data) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center bg-muted/10 rounded-2xl border border-dashed border-border">
          <AlertCircle className="w-10 h-10 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium text-foreground">No Scanned Data</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            We haven't extracted any clinical data for this referral yet.
          </p>
        </div>
      );
    }


    let parsedData = data;
    if (typeof data === "string") {
      try {
        parsedData = JSON.parse(data);
        if (typeof parsedData === "string") parsedData = JSON.parse(parsedData);
      } catch (e) {
        try {
          const cleaned = data.replace(/\\"/g, '"').replace(/^"|"$/g, '');
          parsedData = JSON.parse(cleaned);
        } catch (e2) {
          console.warn("OCR Parsing failed:", e2);
          return (
            <div className="flex flex-col items-center justify-center py-12 text-center bg-muted/10 rounded-2xl border border-dashed border-border">
              <AlertCircle className="w-10 h-10 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium text-foreground">Data Not Found</h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                The scanned document data could not be parsed correctly.
              </p>
            </div>
          );
        }
      }
    }

    if (parsedData && parsedData.data && typeof parsedData.data === "object" && !parsedData.face_to_face) {
      parsedData = parsedData.data;
    }

    const METADATA_KEYS = ["processed_document_count", "success", "message", "status"];
    const sections = parsedData
      ? Object.keys(parsedData).filter(key =>
        !METADATA_KEYS.includes(key.toLowerCase()) &&
        typeof parsedData[key] === "object" &&
        parsedData[key] !== null
      )
      : [];

    if (sections.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center bg-muted/10 rounded-2xl border border-dashed border-border">
          <Info className="w-10 h-10 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium text-foreground">No Structured Report</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            The scanned documents are still being processed or no structured data could be extracted.
          </p>
        </div>
      );
    }

    const renderValue = (val, key = "") => {
      if (val === null || val === undefined || val === "") {
        return <span className="text-muted-foreground/30 italic font-normal">Not provided</span>;
      }

      if (Array.isArray(val)) {
        if (val.length === 0) return <span className="text-muted-foreground/30 italic font-normal">None reported</span>;

        // Check if it's an array of objects (like medications or labs)
        const isArrayOfObjects = typeof val[0] === "object" && val[0] !== null && !Array.isArray(val[0]);

        if (isArrayOfObjects) {
          const headers = Object.keys(val[0]);
          return (
            <div className="mt-4 overflow-hidden rounded-xl border border-border/50 shadow-sm bg-background/50">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border/50">
                      {headers.map(h => (
                        <th key={h} className="px-4 py-2.5 font-black text-primary/70 uppercase tracking-widest whitespace-nowrap">
                          {h.replace(/_/g, " ")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {val.map((item, idx) => (
                      <tr key={idx} className="hover:bg-primary/5 transition-colors">
                        {headers.map(h => (
                          <td key={h} className="px-4 py-2.5 font-medium text-foreground/90">
                            {renderValue(item[h], h)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        }

        return (
          <div className="mt-2 space-y-2">
            {val.map((item, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm leading-relaxed text-foreground/80">
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
                <span>{String(item)}</span>
              </div>
            ))}
          </div>
        );
      }

      if (typeof val === "boolean") {
        return (
          <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${val ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
            }`}>
            {val ? (
              <><CheckCircle2 className="w-3 h-3" /> Yes</>
            ) : (
              <><AlertCircle className="w-3 h-3" /> No</>
            )}
          </div>
        );
      }

      if (typeof val === "object") {
        const isHeaderSection = key.toLowerCase().startsWith("section_") || 
                               key.toLowerCase().includes("insurance") || 
                               key.toLowerCase().includes("physicians") ||
                               key.toLowerCase().includes("extra");
        
        const entries = Object.entries(val);
        const hasNestedObjects = entries.some(([_, v]) => typeof v === 'object' && v !== null);

        return (
          <div className={`mt-3 space-y-4 ${isHeaderSection ? "p-4 bg-muted/30 rounded-xl border border-border/50 shadow-sm" : "pl-4 border-l-2 border-primary/10 ml-1"}`}>
            {isHeaderSection && (
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary uppercase">
                  {key.includes("_") ? key.split('_').slice(-1)[0].charAt(0) : key.charAt(0)}
                </div>
                <span className="text-xs font-black text-primary uppercase tracking-widest">
                  {key.replace(/_/g, " ")}
                </span>
              </div>
            )}
            <div className={`grid gap-x-8 gap-y-4 ${hasNestedObjects ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
              {entries.map(([k, v]) => (
                <div key={k} className={`space-y-1 ${typeof v === 'string' && v.length > 150 ? 'sm:col-span-2' : ''}`}>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block opacity-70">
                    {k.replace(/_/g, " ")}
                  </span>
                  <div className="text-sm font-medium">{renderValue(v, k)}</div>
                </div>
              ))}
            </div>
          </div>
        );
      }

      const strVal = String(val);
      if (strVal.length > 100) {
        return (
          <p className="text-sm leading-relaxed text-foreground/80 bg-muted/20 p-3 rounded-lg border-l-4 border-primary/20">
            {strVal}
          </p>
        );
      }

      return <span className="text-sm font-semibold text-foreground/90">{strVal}</span>;
    };

    return (
      <div className="space-y-8">
        {sections.map(sectionType => {
          const sectionData = parsedData[sectionType];
          if (typeof sectionData !== "object" || sectionData === null) return null;

          return Object.entries(sectionData).map(([docId, doc]) => {
            if (!doc || typeof doc !== "object") return null;
            const extractionBase = doc.extracted_data || doc;

            return (
              <Card key={sectionType + docId} className="overflow-hidden border border-border/60 shadow-sm bg-card/50 backdrop-blur-sm rounded-2xl group">
                <div className="p-4 bg-gradient-to-r from-primary/5 via-transparent to-transparent flex items-center justify-between border-b border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[9px] font-black uppercase tracking-widest px-1.5 py-0">
                          {sectionType.replace(/_/g, " ")}
                        </Badge>
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{docId}</span>
                      </div>
                      <h4 className="text-md font-bold text-foreground mt-0.5 tracking-tight">
                        {doc.document_name || "Clinical Document"}
                      </h4>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {doc.confidence && (
                      <div className="hidden sm:flex flex-col items-end mr-2">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-50">Score</span>
                        <span className={`text-[10px] font-black uppercase ${doc.confidence === 'high' ? 'text-emerald-500' : 'text-amber-500'}`}>
                          {doc.confidence}
                        </span>
                      </div>
                    )}
                    {doc.url && (
                      <a href={doc.url} target="_blank" rel="noopener noreferrer"
                        className="p-2 rounded-lg bg-background border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-primary"
                        title="View Source File">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
                <div className="p-6">
                  {typeof extractionBase === "object" && extractionBase !== null ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                      {Object.entries(extractionBase).map(([key, value]) => {
                        const isLarge = Array.isArray(value) || (typeof value === 'string' && value.length > 100) || typeof value === 'object';
                        return (
                          <div key={key} className={`space-y-1.5 group/field ${isLarge ? 'md:col-span-2' : ''}`}>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black text-primary uppercase tracking-[0.15em] opacity-40 group-hover/field:opacity-100 transition-opacity whitespace-nowrap">
                                {key.replace(/_/g, " ")}
                              </span>
                              <div className="h-[1px] flex-1 bg-gradient-to-r from-primary/10 to-transparent"></div>
                            </div>
                            <div className="pl-1">
                              {renderValue(value, key)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center bg-muted/5 rounded-xl border border-dashed border-border">
                      <Info className="w-6 h-6 text-muted-foreground/30 mb-2" />
                      <p className="text-xs text-muted-foreground italic">No structured data found.</p>
                    </div>
                  )}
                </div>
              </Card>
            );
          });
        })}
      </div>
    );
  };

  if (!referral) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-3xl" data-testid="documents-dialog">
        <DialogHeader className="px-8 pt-8 pb-4 border-b bg-background/50 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold tracking-tight text-foreground">Referral Documents</DialogTitle>
          </div>
          <div className="pt-2 flex flex-wrap gap-x-6 gap-y-1">
            <p className="text-xs text-muted-foreground uppercase font-black tracking-widest opacity-60">
              <span className="text-primary mr-1.5">•</span>
              {referral.patient_name}
            </p>
            <p className="text-xs text-muted-foreground uppercase font-black tracking-widest opacity-60">
              <span className="text-primary mr-1.5">•</span>
              {referral.referral_source}
            </p>
          </div>
        </DialogHeader>

        <Tabs defaultValue="manage" className="flex-1 flex flex-col min-h-0">
          <div className="px-8 py-4 bg-muted/20 border-b">
            <TabsList className="grid h-auto w-full grid-cols-2 p-1 border border-border/50 rounded-xl">
              <TabsTrigger
                value="manage"
                className="rounded-lg py-2.5 text-xs font-bold uppercase tracking-widest transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                Manage Document
              </TabsTrigger>
              <TabsTrigger
                value="scanned"
                className="rounded-lg py-2.5 text-xs font-bold uppercase tracking-widest transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                Scanned Documents
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="manage" className="flex-1 overflow-y-auto p-8 space-y-8 outline-none custom-scrollbar">
            {/* Upload Section */}
            <div className="bg-muted/30 rounded-lg border border-border p-4">
              <h3 className="text-lg font-medium mb-3">Upload Documents</h3>
              <div
                data-testid="doc-upload-zone"
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${dragActive
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
          </TabsContent>

          <TabsContent value="scanned" className="flex-1 overflow-y-auto p-8 outline-none custom-scrollbar bg-muted/5">
            <div className="space-y-6 max-w-4xl mx-auto">
              <div className="flex items-center justify-between pb-2 border-b border-border/50">
                <h3 className="text-lg font-bold tracking-tight">Extracted Clinical Data</h3>
                <div className="px-3 py-1 bg-primary/10 rounded-full text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                  <Activity className="w-3 h-3 animate-pulse" />
                  AI Verified Report
                </div>
              </div>
              <div>
                {renderOCRContent()}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentsDialog;
