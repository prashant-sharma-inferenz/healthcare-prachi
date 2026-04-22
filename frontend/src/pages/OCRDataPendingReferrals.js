import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { File, AlertCircle, CheckCircle } from "lucide-react";

/**
 * OCRDataPendingReferrals
 * Displays extracted OCR data in a structured, document-wise format.
 * Handles parsing derived from backend JSON strings.
 */
const OCRDataPendingReferrals = ({ isOpen, onClose, data }) => {
  if (!isOpen) return null;

  // 1. ROBUST PARSER
  const parsedData = (() => {
    if (!data) return null;
    if (typeof data === "object") return data;
    
    try {
      // Handle standard and double-stringified JSON
      let result = JSON.parse(data);
      if (typeof result === "string") result = JSON.parse(result);
      return result;
    } catch (e) {
      try {
        // Handle escaped JSON common in some database fields
        const cleaned = data.replace(/\\"/g, '"').replace(/^"|"$/g, '');
        return JSON.parse(cleaned);
      } catch (e2) {
        console.warn("OCR Parsing failed:", e2);
        return null;
      }
    }
  })();

  const isEmpty = !parsedData || 
    (!parsedData.face_to_face && 
     !parsedData.other && 
     !parsedData.physician_certification);

  // 2. RECURSIVE VALUE RENDERER
  const renderValue = (val) => {
    if (val === null || val === undefined) {
      return <span className="text-muted-foreground/40 italic">N/A</span>;
    }

    if (Array.isArray(val)) {
      return (
        <ul className="list-disc list-inside space-y-1 mt-1 border-l-2 border-primary/10 pl-4">
          {val.map((item, idx) => (
            <li key={idx} className="text-sm leading-relaxed">{String(item)}</li>
          ))}
        </ul>
      );
    }

    if (typeof val === "object") {
      return (
        <div className="space-y-4 mt-2 ml-2 border-l-2 border-dashed border-primary/20 pl-4 py-1">
          {Object.entries(val).map(([k, v]) => (
            <div key={k} className="space-y-1">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">
                {k.replace(/_/g, " ")}
              </span>
              <div className="text-sm font-semibold">{renderValue(v)}</div>
            </div>
          ))}
        </div>
      );
    }

    if (typeof val === "boolean") {
      return (
        <div className="flex items-center gap-2 mt-1">
          {val ? (
            <><CheckCircle className="w-4 h-4 text-emerald-500" /><span className="text-xs font-bold text-emerald-700">YES</span></>
          ) : (
            <><AlertCircle className="w-4 h-4 text-rose-500" /><span className="text-xs font-bold text-rose-700">NO</span></>
          )}
        </div>
      );
    }

    return <span className="text-sm font-semibold text-foreground/90">{String(val)}</span>;
  };

  // 3. EMPTY STATE MODAL
  if (isEmpty) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-sm p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 pb-0 text-center">
            <DialogTitle className="text-xl font-bold text-primary">Extraction Results</DialogTitle>
          </DialogHeader>
          <div className="p-10 flex flex-col items-center justify-center text-center space-y-4">
            <div className="p-4 bg-muted rounded-full">
              <AlertCircle className="w-10 h-10 text-muted-foreground/30" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-foreground font-display">Data Not Found</h3>
              <p className="text-sm text-muted-foreground px-4">
                No clinical extraction data is available for this record yet.
              </p>
            </div>
            <button 
              onClick={onClose} 
              className="mt-6 px-8 py-2.5 bg-primary text-primary-foreground rounded-full text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg"
            >
              Okay
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // 4. MAIN DATA RENDERER
  const renderDocuments = () => {
    const sections = ["face_to_face", "physician_certification", "other"];
    let cards = [];

    sections.forEach(section => {
      if (parsedData[section]) {
        Object.entries(parsedData[section]).forEach(([docId, doc]) => {
          if (!doc) return;
          const extractionBase = doc.extracted_data || doc;
          
          cards.push(
            <Card key={section + docId} className="overflow-hidden border-none shadow-xl mb-8 bg-card/50 backdrop-blur-md ring-1 ring-white/10">
              <div className="bg-primary/5 p-4 border-b border-primary/10 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg shadow-inner">
                    <File className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-foreground uppercase tracking-tight">
                      {section.replace(/_/g, " ")} • {docId}
                    </h4>
                    <p className="text-[10px] text-muted-foreground truncate max-w-[200px] font-medium">
                      {doc.document_name || "Untitled Document"}
                    </p>
                  </div>
                </div>
                {doc.url && (
                  <a href={doc.url} target="_blank" rel="noopener noreferrer" 
                     className="text-[10px] font-black text-primary hover:bg-primary hover:text-white border border-primary/20 px-4 py-2 rounded-full transition-all bg-background uppercase tracking-tighter">
                    Source File
                  </a>
                )}
              </div>
              
              <div className="p-6 space-y-6">
                {typeof extractionBase === "object" && extractionBase !== null ? (
                  Object.entries(extractionBase).map(([key, value]) => (
                    <div key={key} className="space-y-1 group">
                      <div className="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-3 opacity-70 group-hover:opacity-100 transition-opacity">
                         {key.replace(/_/g, " ")}
                         <div className="h-[1px] flex-1 bg-gradient-to-r from-primary/20 to-transparent"></div>
                      </div>
                      <div className="text-sm font-semibold text-foreground/80 pl-1 leading-relaxed">
                        {renderValue(value)}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground italic">No structured data found in this section.</p>
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
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 border-none rounded-2xl shadow-2xl overflow-hidden ring-1 ring-black/5">
        <DialogHeader className="p-8 border-b bg-background/80 backdrop-blur-lg sticky top-0 z-20">
          <DialogTitle className="text-3xl font-black tracking-tighter text-primary uppercase italic">
            Clinical Data Extraction
          </DialogTitle>
          <DialogDescription className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.3em] mt-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Analysis Complete • {parsedData.processed_document_count || 0} Files
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-gradient-to-b from-muted/20 to-background">
          <div className="max-w-3xl mx-auto pb-10">
            {renderDocuments()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OCRDataPendingReferrals;