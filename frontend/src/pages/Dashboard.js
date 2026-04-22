import React, { useEffect, useState } from "react";
import axios from "axios";
import { Users, Clock, TrendingUp, XCircle, Activity, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import ActivityDialog from "../components/ActivityDialog";
import DocumentsDialog from "../components/DocumentsDialog";
import OCRDataModal from "./OCRDataPendingReferrals";
import sampleOCRData from "../data/sampleOCRData.json";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const MetricCard = ({ title, value, icon: Icon, testId }) => {
  return (
    <div
      data-testid={testId}
      className="bg-card rounded-lg border border-border p-6 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-3xl font-semibold text-foreground">{value}</p>
        </div>
        <div className="p-3 bg-primary/10 rounded-lg">
          <Icon className="w-6 h-6 text-primary" />
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [metrics, setMetrics] = useState({
    total_referrals: 0,
    total_pending_admission: 0,
    conversion_percentage: 0,
    total_non_admit: 0,
  });
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReferral, setSelectedReferral] = useState(null);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [documentsDialogOpen, setDocumentsDialogOpen] = useState(false);
  const [docsReferral, setDocsReferral] = useState(null);
  const [ocrDataOpen, setOcrDataOpen] = useState(false);
  const [ocrReferral, setOcrReferral] = useState(null);
  const [ocrData, setOcrData] = useState(null);
  const [automationSettings, setAutomationSettings] = useState(null);
  const [triggeringAdmission, setTriggeringAdmission] = useState(null);
  const [confirmAdmissionOpen, setConfirmAdmissionOpen] = useState(false);
  const [referralToAdmit, setReferralToAdmit] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [metricsRes, referralsRes, settingsRes] = await Promise.all([
        axios.get(`${API}/metrics`),
        axios.get(`${API}/referrals`),
        axios.get(`${API}/settings`),
      ]);

      setMetrics(metricsRes.data);
      setReferrals(referralsRes.data);
      setAutomationSettings(settingsRes.data.automation || null);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleReferralClick = (referral) => {
    setSelectedReferral(referral);
    setActivityDialogOpen(true);
  };

  const handleDocsClick = (e, referral) => {
    e.stopPropagation();
    setDocsReferral(referral);
    setDocumentsDialogOpen(true);
  };

  const handleOcrDataClick = (e, referral) => {
    e.stopPropagation();
    setOcrReferral(referral);
    setOcrData(referral.notes);
    setOcrDataOpen(true);
  };

  const handleConfirmAdmission = (e, referral) => {
    e.stopPropagation();
    setReferralToAdmit(referral);
    setConfirmAdmissionOpen(true);
  };

  const handleTriggerAdmission = async () => {
    if (!referralToAdmit) return;
    const referral = referralToAdmit;
    setConfirmAdmissionOpen(false);

    if (!automationSettings) {
      toast.error("Automation settings not loaded. Please try again in a moment.");
      return;
    }

    if (triggeringAdmission === referral.id) return;

    try {
      setTriggeringAdmission(referral.id);
      const auto = automationSettings;
      const domain = auto.domain_name || process.env.REACT_APP_CAREGENCE_API_PATH;
      const webhook = auto.webhook_url || "/utility/start-workflow-trigger";
      const email = auto.admin_username || process.env.REACT_APP_ADMIN_USERNAME;
      
      let password = auto.admin_password;
      if (!password || password.includes("****")) {
        password = process.env.REACT_APP_ADMIN_PASSWORD;
      }
      
      const workflowId = auto.admission_workflow_id || "64883175-3443-4b73-982a-ef222fca75ca";

      const loginResponse = await axios.post(`${domain}/users/login`, {
        email: email,
        password: password
      });

      if (loginResponse.data?.success) {
        const accessToken = loginResponse.data.data.access_token;
        
        await axios.post(
          `${domain}${webhook}?workflow_id=${workflowId}`,
          {
            referral_id: referral.id,
            patient_name: referral.patient_name,
            referral_source: referral.referral_source,
            s3_path: "" // Placeholder as s3_path isn't directly available on dashboard
          },
          {
            headers: { Authorization: `Bearer ${accessToken}` }
          }
        );
        toast.success(`Admission workflow triggered for ${referral.patient_name}`);
      } else {
        toast.error("Failed to authenticate with Caregence API");
      }
    } catch (err) {
      console.error("Error triggering admission workflow:", err);
      toast.error("Failed to trigger admission workflow. Check settings and credentials.");
    } finally {
      setTriggeringAdmission(null);
    }
  };

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      {/* Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-semibold text-foreground tracking-tight">
          Dashboard
        </h1>
        <p className="text-muted-foreground mt-2">Overview of your referral pipeline</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Referrals"
          value={metrics.total_referrals}
          icon={Users}
          testId="metric-total-referrals"
        />
        <MetricCard
          title="Pending Admission"
          value={metrics.total_pending_admission}
          icon={Clock}
          testId="metric-pending-admission"
        />
        <MetricCard
          title="Conversion Rate"
          value={`${metrics.conversion_percentage}%`}
          icon={TrendingUp}
          testId="metric-conversion-rate"
        />
        <MetricCard
          title="Non-Admit"
          value={metrics.total_non_admit}
          icon={XCircle}
          testId="metric-non-admit"
        />
      </div>

      {/* Pending Referrals Table */}
      <div className="bg-card rounded-lg border border-border shadow-sm">
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-medium text-foreground">Pending Referrals</h2>
          <p className="text-sm text-muted-foreground mt-1">Click on a referral to view and add activities</p>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : referrals.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground" data-testid="no-referrals-message">
              No pending referrals at the moment
            </div>
          ) : (
            <table className="w-full" data-testid="referrals-table">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left text-xs uppercase tracking-wider font-medium text-muted-foreground px-6 py-3">
                    Patient Name
                  </th>
                  <th className="text-left text-xs uppercase tracking-wider font-medium text-muted-foreground px-6 py-3">
                    Referral Source
                  </th>
                  <th className="text-left text-xs uppercase tracking-wider font-medium text-muted-foreground px-6 py-3">
                    Date
                  </th>
                  <th className="text-left text-xs uppercase tracking-wider font-medium text-muted-foreground px-6 py-3">
                    Status
                  </th>
                  <th className="text-left text-xs uppercase tracking-wider font-medium text-muted-foreground px-6 py-3">
                    Eligibility
                  </th>
                  <th className="text-left text-xs uppercase tracking-wider font-medium text-muted-foreground px-6 py-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {referrals.map((referral) => (
                  <tr
                    key={referral.id}
                    data-testid={`referral-row-${referral.id}`}
                    className="hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => handleReferralClick(referral)}
                  >
                    <td className="px-6 py-4 text-sm font-medium text-foreground">
                      {referral.patient_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground capitalize">
                      {referral.referral_source}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {formatDate(referral.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary capitalize">
                        {referral.status}
                      </span>
                    </td>
                     <td className="px-6 py-4">
                      {(() => {
                        const status = referral.is_eligible == null
                          ? "Processing"
                          : referral.is_eligible === "eligible" || referral.is_eligible === "Eligible"
                          ? "Eligible"
                          : "Not Eligible";

                        const statusClass =
                          status === "Processing"
                            ? "bg-amber-100 text-amber-700"
                            : status === "Eligible"
                            ? "bg-emerald-100 text-emerald-700 cursor-pointer hover:bg-emerald-200 active:scale-95"
                            : "bg-rose-100 text-rose-700";

                        return (
                          <span 
                            onClick={(e) => {
                              if (status === "Eligible" && triggeringAdmission !== referral.id) {
                                handleConfirmAdmission(e, referral);
                              }
                            }}
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize shadow-sm transition-all ${statusClass} ${
                              triggeringAdmission === referral.id ? "animate-pulse opacity-70" : ""
                            }`}
                          >
                            {triggeringAdmission === referral.id ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
                                Triggering...
                              </>
                            ) : (
                              status
                            )}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        <button
                          data-testid={`view-activities-btn-${referral.id}`}
                          className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReferralClick(referral);
                          }}
                        >
                          <Activity className="w-4 h-4" />
                          Activities
                        </button>
                        <button
                          data-testid={`view-documents-btn-${referral.id}`}
                          className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                          onClick={(e) => handleDocsClick(e, referral)}
                        >
                          <FileText className="w-4 h-4" />
                          Documents
                        </button>
                        <button
                          data-testid={`view-ocr-data-btn-${referral.id}`}
                          className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                          onClick={(e) => handleOcrDataClick(e, referral)}
                        >
                          <FileText className="w-4 h-4" />
                          Scanned Documents
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Activity Dialog */}
      <ActivityDialog
        open={activityDialogOpen}
        onOpenChange={setActivityDialogOpen}
        referral={selectedReferral}
      />

      {/* Documents Dialog */}
      <DocumentsDialog
        open={documentsDialogOpen}
        onOpenChange={setDocumentsDialogOpen}
        referral={docsReferral}
      />

      {/* OCR Data Modal */}
      <OCRDataModal
        isOpen={ocrDataOpen}
        onClose={() => setOcrDataOpen(false)}
        data={ocrData}
      />

      {/* Confirmation Dialog for Admission */}
      <Dialog open={confirmAdmissionOpen} onOpenChange={setConfirmAdmissionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-primary flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Confirm Admission Workflow
            </DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Are you sure you want to trigger the <span className="font-bold text-foreground">Admission Workflow</span> for this patient?
            </p>
            <div className="bg-muted/50 p-4 rounded-lg border border-border space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Patient Name:</span>
                <span className="font-bold text-foreground">{referralToAdmit?.patient_name}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Referral Source:</span>
                <span className="font-bold text-foreground capitalize">{referralToAdmit?.referral_source}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Referral ID:</span>
                <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[150px]">
                  {referralToAdmit?.id}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Workflow:</span>
                <span className="text-primary font-bold">Admission Processing</span>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-3 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setConfirmAdmissionOpen(false)}
              className="rounded-full"
            >
              Cancel
            </Button>
            <Button
              onClick={handleTriggerAdmission}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-6"
            >
              Yes, Trigger Workflow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
