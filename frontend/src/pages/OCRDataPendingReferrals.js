import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle } from "lucide-react";

const OCRDataPendingReferrals = ({ isOpen, onClose, data }) => {
  // If data is absolutely missing from the prop, we can still decide to show the modal with a message
  const isEmptyData = !data || (typeof data === "string" && data.trim() === "") || data === "null";

  // 🔍 DEBUG LOGS
  console.log("RAW DATA TYPE:", typeof data);
  console.log("RAW DATA VALUE:", data);

  // ✅ SAFE PARSER (handles bad JSON)
  const safeParse = (input) => {
    if (!input) return null;

    // already object
    if (typeof input === "object") return input;

    try {
      // first attempt
      let parsed = JSON.parse(input);

      // double encoded case
      if (typeof parsed === "string") {
        parsed = JSON.parse(parsed);
      }

      return parsed;
    } catch (e1) {
      console.warn("First parse failed, trying cleanup...");

      try {
        // remove escape characters
        const cleaned = input
          .replace(/\\"/g, '"')
          .replace(/"\{/g, "{")
          .replace(/\}"/g, "}");

        return JSON.parse(cleaned);
      } catch (e2) {
        console.error("❌ FINAL PARSE FAILED:", e2);
        return null;
      }
    }
  };

  const parsedData = safeParse(data);

  // ❌ If still invalid or empty after parsing
  if (isEmptyData || !parsedData) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-xl font-bold text-primary">Extraction Result</DialogTitle>
          </DialogHeader>
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="p-4 bg-muted rounded-full">
              <AlertCircle className="w-10 h-10 text-muted-foreground/50" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-foreground">Data Not Found</h3>
              <p className="text-sm text-muted-foreground">
                No OCR extraction data is available for this referral yet.
              </p>
            </div>
            <button 
              onClick={onClose}
              className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-full text-sm font-bold hover:bg-primary/90 transition-colors"
            >
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ✅ FLATTEN JSON
  const flattenObject = (obj, result = {}) => {
    Object.keys(obj).forEach((key) => {
      if (key === "url" || key === "s3_url") return;

      const value = obj[key];

      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        flattenObject(value, result);
      } else if (Array.isArray(value)) {
        result[key] = value.join(", ");
      } else {
        result[key] = value;
      }
    });

    return result;
  };

  const flatData = flattenObject(parsedData);

  // ✅ FORMAT KEY
  const formatKey = (key) =>
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0">

        {/* HEADER */}
        <DialogHeader className="p-6 border-b">
          <DialogTitle className="text-xl font-bold text-primary">
            Extraction Details
          </DialogTitle>
        </DialogHeader>

        {/* ✅ CLEAN KEY : VALUE UI */}
        <div className="p-6 overflow-y-auto">
          {Object.entries(flatData).map(([key, value]) => (
            <div key={key} className="border-b py-2 text-sm">
              <span className="font-semibold">
                {formatKey(key)} :
              </span>{" "}
              <span>
                {value === true
                  ? "Yes"
                  : value === false
                    ? "No"
                    : value || "N/A"}
              </span>
            </div>
          ))}
        </div>

      </DialogContent>
    </Dialog>
  );
};

export default OCRDataPendingReferrals;