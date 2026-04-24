import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Badge } from "../components/ui/badge";
import { Card } from "../components/ui/card";
import {
  FileText,
  AlertCircle,
  CheckCircle2,
  User,
  Calendar,
  Activity,
  ClipboardCheck,
  ExternalLink,
  ChevronRight,
  Info
} from "lucide-react";

/**
 * OCRDataPendingReferrals
 * Displays extracted OCR data in a structured, premium report format.
 */
const OCRDataPendingReferrals = ({ isOpen, onClose, data }) => {
  if (!isOpen) return null;

  // 1. ROBUST PARSER
  const parsedData = (() => {
    if (!data) return null;
    let result = data;

    // A. Parse if string
    if (typeof data === "string") {
      try {
        result = JSON.parse(data);
        if (typeof result === "string") result = JSON.parse(result);
      } catch (e) {
        try {
          const cleaned = data.replace(/\\"/g, '"').replace(/^"|"$/g, '');
          result = JSON.parse(cleaned);
        } catch (e2) {
          console.warn("OCR Parsing failed:", e2);
          return null;
        }
      }
    }

    // B. Handle the "data" wrapper if it's present (common from API responses)
    if (result && result.data && typeof result.data === "object" && !result.face_to_face) {
      result = result.data;
    }

    return result;
  })();

  // 2. DYNAMIC SECTION DETECTION
  const METADATA_KEYS = ["processed_document_count", "success", "message", "status"];
  
  const sections = parsedData 
    ? Object.keys(parsedData).filter(key => 
        !METADATA_KEYS.includes(key.toLowerCase()) && 
        typeof parsedData[key] === "object" && 
        parsedData[key] !== null
      )
    : [];

  const isEmpty = sections.length === 0;

  // 3. RECURSIVE VALUE RENDERER
  const renderValue = (val, key = "") => {
    if (val === null || val === undefined || val === "") {
      return <span className="text-muted-foreground/30 italic font-normal">Not provided</span>;
    }

    // Handle Arrays (e.g., Clinical Findings, lists of conditions)
    if (Array.isArray(val)) {
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

    // Handle Booleans (Checklist items)
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

    // Handle Nested Objects (e.g., Sections A/B/C or complex structures like 'primary_insurance')
    if (typeof val === "object") {
      const isHeaderSection = key.toLowerCase().startsWith("section_") || key.toLowerCase().includes("insurance");
      return (
        <div className={`mt-3 space-y-4 ${isHeaderSection ? "p-4 bg-muted/30 rounded-xl border border-border/50 shadow-sm" : "pl-4 border-l-2 border-primary/10 ml-1"}`}>
          {isHeaderSection && (
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary uppercase">
                {key.includes("_") ? key.split('_')[1].charAt(0) : key.charAt(0)}
              </div>
              <span className="text-xs font-black text-primary uppercase tracking-widest">
                {key.replace(/_/g, " ")}
              </span>
            </div>
          )}
          <div className="grid grid-cols-1 gap-y-4">
            {Object.entries(val).map(([k, v]) => (
              <div key={k} className="space-y-1">
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

    // Handle Strings (long text vs short)
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

  // 4. EMPTY STATE
  if (isEmpty) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-sm p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <div className="p-10 flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center relative">
              <AlertCircle className="w-10 h-10 text-muted-foreground/30" />
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-rose-500 rounded-full border-4 border-background animate-pulse" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-foreground">No Report Available</h3>
              <p className="text-sm text-muted-foreground">
                We haven't extracted any clinical data for this referral yet. Please check back later.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full py-4 bg-primary text-primary-foreground rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:brightness-110 active:scale-[0.98] transition-all shadow-xl shadow-primary/20"
            >
              Back to Dashboard
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // 5. MAIN DATA RENDERER
  const renderDocuments = () => {
    let cards = [];

    sections.forEach(sectionType => {
      const sectionData = parsedData[sectionType];
      
      // Handle the case where section contains doc_1, doc_2
      if (typeof sectionData === "object" && sectionData !== null) {
        Object.entries(sectionData).forEach(([docId, doc]) => {
          if (!doc || typeof doc !== "object") return;
          const extractionBase = doc.extracted_data || doc;

          cards.push(
            <Card key={sectionType + docId} className="overflow-hidden border border-border/60 shadow-xl mb-10 bg-card/80 backdrop-blur-md rounded-3xl group">
              {/* Document Header */}
              <div className="p-6 bg-gradient-to-r from-primary/5 via-transparent to-transparent flex items-center justify-between border-b border-border/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-sm group-hover:scale-110 transition-transform">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] font-black uppercase tracking-widest px-2 py-0">
                        {sectionType.replace(/_/g, " ")}
                      </Badge>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{docId}</span>
                    </div>
                    <h4 className="text-lg font-bold text-foreground mt-0.5 tracking-tight">
                      {doc.document_name || "Clinical Document"}
                    </h4>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {doc.confidence && (
                    <div className="hidden sm:flex flex-col items-end">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-50">Score</span>
                      <span className={`text-xs font-black uppercase ${doc.confidence === 'high' ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {doc.confidence}
                      </span>
                    </div>
                  )}
                  {doc.url && (
                    <a href={doc.url} target="_blank" rel="noopener noreferrer"
                      className="p-3 rounded-xl bg-background border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-primary"
                      title="View Source File">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>

              {/* Document Content */}
              <div className="p-8">
                {typeof extractionBase === "object" && extractionBase !== null ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                    {Object.entries(extractionBase).map(([key, value]) => {
                      const isLarge = Array.isArray(value) || (typeof value === 'string' && value.length > 100) || typeof value === 'object';
                      return (
                        <div key={key} className={`space-y-2 group/field ${isLarge ? 'md:col-span-2' : ''}`}>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] opacity-40 group-hover/field:opacity-100 transition-opacity whitespace-nowrap">
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
                  <div className="flex flex-col items-center justify-center py-12 text-center bg-muted/10 rounded-2xl border border-dashed border-border">
                    <Info className="w-8 h-8 text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground italic">No structured data found in this section.</p>
                  </div>
                )}
              </div>
            </Card>
          );
        });
      }
    });

    return cards;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 border-none rounded-[2rem] shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-8 pb-6 border-b bg-background/80 backdrop-blur-xl sticky top-0 z-20 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="px-3 py-1 bg-primary text-primary-foreground rounded-full text-[10px] font-black uppercase tracking-[0.2em]">
                Report
              </div>
              <div className="h-[1px] w-8 bg-border" />
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.4em]">
                {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <DialogTitle className="text-2xl font-black tracking-tighter text-foreground uppercase leading-none mt-1">
              Transcription <span className="text-primary">&</span> Extraction
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-muted-foreground mt-3 flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <ClipboardCheck className="w-4 h-4 text-emerald-500" />
                Verified results • {parsedData.processed_document_count || 0} Files processed
              </span>
              <span className="w-1 h-1 rounded-full bg-border" />
              <span className="flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-primary" />
                OCR Confidence: High
              </span>
            </DialogDescription>
          </div>

          <button
            onClick={onClose}
            className="p-4 rounded-full bg-muted/50 hover:bg-muted transition-colors sm:hidden"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 custom-scrollbar bg-gradient-to-b from-muted/30 to-background/50">
          <div className="max-w-4xl mx-auto">
            {renderDocuments()}
          </div>

          {/* Footer inside body */}
          <div className="max-w-4xl mx-auto mt-10 pt-10 border-t border-border/50 text-center space-y-4 pb-20">
            <div className="flex items-center justify-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">
              <div className="w-8 h-[1px] bg-border" />
              End of Clinical Report
              <div className="w-8 h-[1px] bg-border" />
            </div>
            <p className="text-[10px] text-muted-foreground max-w-md mx-auto leading-relaxed">
              This report is generated using advanced AI extraction. Always verify findings against original medical documentation.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OCRDataPendingReferrals;