import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import OCRDataModal from "./OCRDataPendingReferrals";
import sampleOCRData from "../data/sampleOCRData.json";
import { FileText, Upload } from "lucide-react";
import { toast } from "sonner";

const OCRDataPage = () => {
  const [ocrData, setOcrData] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLoadSampleData = () => {
    setOcrData(sampleOCRData);
    setIsModalOpen(true);
    toast.success("Sample data loaded successfully");
  };

  // Load sample data automatically on mount
  useEffect(() => {
    setOcrData(sampleOCRData);
    setIsModalOpen(true);
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("file", file);

      // Replace with your actual API endpoint
      const response = await fetch("/api/process-ocr-documents", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setOcrData(data);
        setIsModalOpen(true);
        toast.success("Documents processed successfully");
      } else {
        toast.error("Failed to process documents");
      }
    } catch (error) {
      toast.error("Error uploading file");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">OCR Data - Pending Referrals</h1>
        <p className="text-muted-foreground">
          View and manage OCR-processed hospice documents
        </p>
      </div>

      <div className="grid gap-4">
        <Card className="p-6">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1">
              <h2 className="text-lg font-semibold mb-2">Upload Documents</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Upload PDF documents for OCR processing
              </p>
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                disabled={loading}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <Button
                  asChild
                  disabled={loading}
                  variant="outline"
                  className="cursor-pointer"
                >
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    {loading ? "Processing..." : "Choose File"}
                  </span>
                </Button>
              </label>
            </div>
            <Button onClick={handleLoadSampleData} className="w-full md:w-auto">
              <FileText className="w-4 h-4 mr-2" />
              Load Sample Data
            </Button>
          </div>
        </Card>
      </div>

      {/* Modal for displaying OCR data */}
      <OCRDataModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        data={ocrData}
      />
    </div>
  );
};

export default OCRDataPage;
