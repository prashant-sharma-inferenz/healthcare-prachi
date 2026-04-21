import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, File } from "lucide-react";

const OCRDataPendingReferrals = ({ isOpen, onClose, data }) => {
  const [activeTab, setActiveTab] = useState("data");

  if (!data) {
    return null;
  }

  const prognosisData = data?.data?.data?.prognosis || [];
  const eligibilitySummary = data?.data?.eligibility_summary || {};
  const criteriaResults = eligibilitySummary?.criteria_results || {};

  const renderInsightValue = (value) => {
    if (typeof value === "object") {
      return <pre className="text-xs bg-muted p-2 rounded overflow-auto">{JSON.stringify(value, null, 2)}</pre>;
    }
    if (Array.isArray(value)) {
      return (
        <div className="flex flex-wrap gap-2">
          {value.map((item, idx) => (
            <Badge key={idx} variant="secondary">
              {item}
            </Badge>
          ))}
        </div>
      );
    }
    if (typeof value === "boolean") {
      return value ? (
        <CheckCircle2 className="w-5 h-5 text-green-500" />
      ) : (
        <AlertCircle className="w-5 h-5 text-red-500" />
      );
    }
    return <span>{String(value)}</span>;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
        <div className="p-6 pb-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
              <File className="w-6 h-6" />
              OCR Data - Pending Referrals
            </DialogTitle>
            <DialogDescription className="text-muted-foreground flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="px-2 py-0.5 font-medium">
                {data?.data?.processed_document_count || 0} Documents Processed
              </Badge>
              <span className="text-xs">•</span>
              <span className="text-xs">Review and verify document insights</span>
            </DialogDescription>
          </DialogHeader>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <div className="px-6 bg-background/50 border-b">
            <TabsList className="bg-transparent h-auto p-0 gap-8 justify-start">
              <TabsTrigger
                value="data"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-3 text-sm font-semibold transition-all hover:text-primary/80"
              >
                Data Extraction
              </TabsTrigger>
              <TabsTrigger
                value="eligibility_summary"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-3 text-sm font-semibold transition-all hover:text-primary/80"
              >
                Eligibility Summary
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="p-6">
              {/* Data Tab */}
              <TabsContent value="data" className="mt-0 space-y-6 outline-none">
                <div className="space-y-6">
                  {/* Prognosis Section */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-foreground">Prognosis Documents</h3>
                      <p className="text-xs text-muted-foreground">Expand to view detailed extraction</p>
                    </div>
                    <Accordion type="single" collapsible className="w-full space-y-3">
                      {prognosisData.map((prognosis, idx) => (
                        <AccordionItem
                          key={idx}
                          value={`prognosis-${idx}`}
                          className="border rounded-xl bg-card px-4 overflow-hidden transition-all hover:shadow-md"
                        >
                          <AccordionTrigger className="hover:no-underline py-4">
                            <div className="flex items-center gap-4 w-full text-left">
                              <div className="p-2 bg-primary/10 rounded-lg">
                                <File className="w-5 h-5 text-primary" />
                              </div>
                              <div className="flex-1">
                                <p className="font-bold text-foreground">{prognosis.document_name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider color-primary">
                                    {prognosis.document_type}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground bg-primary/5 px-2 py-0.5 rounded-full">
                                    Confidence: {(prognosis.confidence * 100).toFixed(0)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-4 pb-4">
                              {/* S3 URL */}
                              <div className="p-3 bg-muted/40 rounded-lg flex items-center justify-between gap-4 border border-dashed">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="p-1.5 bg-background rounded border">
                                    <File className="w-3.5 h-3.5 text-muted-foreground" />
                                  </div>
                                  <span className="text-xs font-medium text-muted-foreground truncate max-w-[400px]">
                                    Source: {prognosis.s3_url}
                                  </span>
                                </div>
                                <a
                                  href={prognosis.s3_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] font-bold text-primary hover:underline bg-primary/10 px-3 py-1 rounded-full whitespace-nowrap"
                                >
                                  Open Original
                                </a>
                              </div>

                              {/* Insights */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {Object.entries(prognosis.insights || {}).map(
                                  ([key, value]) => (
                                    <div key={key} className="p-4 rounded-xl border bg-background/50">
                                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                        {key.replace(/_/g, " ")}
                                      </label>
                                      <div className="mt-2 font-medium">
                                        {renderInsightValue(value)}
                                      </div>
                                    </div>
                                  )
                                )}
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                </div>
              </TabsContent>

              {/* Eligibility Summary Tab */}
              <TabsContent
                value="eligibility_summary"
                className="mt-0 space-y-6 outline-none"
              >
                <div className="space-y-6">
                  {/* Overall Status Card */}
                  <div className="relative overflow-hidden p-6 rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background">
                    <div className="absolute top-0 right-0 p-8 opacity-10 blur-2xl bg-primary w-32 h-32 rounded-full -mr-16 -mt-16"></div>
                    <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Eligibility Score</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-extrabold text-primary">{eligibilitySummary.total_score}</span>
                          <span className="text-lg font-medium text-muted-foreground">/100</span>
                        </div>
                        <div className="w-full bg-primary/10 h-1.5 rounded-full mt-2 overflow-hidden">
                          <div 
                            className="bg-primary h-full transition-all duration-1000" 
                            style={{ width: `${eligibilitySummary.total_score}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Assessment Status</p>
                        <div className="flex items-center gap-2 mt-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${eligibilitySummary.status === "Review" ? "bg-amber-500" : "bg-green-500"} animate-pulse`}></div>
                          <Badge
                            variant={eligibilitySummary.status === "Review" ? "outline" : "secondary"}
                            className={`px-3 py-1 font-bold text-sm ${eligibilitySummary.status === "Review" ? "border-amber-200 text-amber-700 bg-amber-50" : "bg-green-100 text-green-700 hover:bg-green-100"}`}
                          >
                            {eligibilitySummary.status}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-2">Requires clinical verification</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Evidence Level</p>
                        <p className="text-2xl font-bold mt-1">High Confidence</p>
                        <p className="text-[11px] text-muted-foreground">Based on {data?.data?.processed_document_count} processed documents</p>
                      </div>
                    </div>
                  </div>

                  {/* Criteria Results */}
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-4">Met Criteria Breakdown</h3>
                    <Accordion type="single" collapsible className="w-full space-y-3">
                      {Object.entries(criteriaResults).map(([criteriaKey, criteria]) => (
                        <AccordionItem 
                          key={criteriaKey} 
                          value={criteriaKey}
                          className="border rounded-xl bg-card px-4 overflow-hidden transition-all hover:shadow-md"
                        >
                          <AccordionTrigger className="hover:no-underline py-4">
                            <div className="flex items-center gap-4 w-full text-left">
                              <div className={`p-2 rounded-lg ${criteria.met ? "bg-green-100" : "bg-red-100"}`}>
                                {criteria.met ? (
                                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                                ) : (
                                  <AlertCircle className="w-5 h-5 text-red-600" />
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-foreground capitalize">
                                    {criteriaKey.replace(/_/g, " ")}
                                  </p>
                                  {criteria.met && (
                                    <Badge className="bg-green-500/10 text-green-600 border-none text-[10px] px-1.5 py-0">MATCH</Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs font-medium text-muted-foreground capitalize">
                                    {criteria.level || 'Assessment'} level
                                  </span>
                                  <span className="text-xs text-muted-foreground opacity-30">•</span>
                                  <span className="text-xs font-bold text-primary">
                                    Score: {criteria.score}/{criteria.weight}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-4 pb-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                {Object.entries(criteria).map(([key, value]) => {
                                  if (key === 'met' || key === 'score' || key === 'weight') return null;
                                  return (
                                    <div key={key} className="p-3 rounded-lg bg-muted/30 border">
                                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                        {key.replace(/_/g, " ")}
                                      </label>
                                      <div className="mt-1.5 text-sm font-medium">
                                        {renderInsightValue(value)}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>

                  {/* Supporting Signals */}
                  {eligibilitySummary.supporting_signals && (
                    <div className="rounded-2xl border p-6 bg-muted/20">
                      <h3 className="text-sm font-bold text-foreground uppercase tracking-widest mb-4">Clinical Supporting Signals</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {Object.entries(eligibilitySummary.supporting_signals).map(
                          ([key, value]) => (
                            <div key={key} className="space-y-2">
                              <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-[0.2em]">
                                {key.replace(/_/g, " ")}
                              </label>
                              <div className="p-3 bg-background rounded-xl border border-primary/5 shadow-sm">
                                {renderInsightValue(value)}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default OCRDataPendingReferrals;
