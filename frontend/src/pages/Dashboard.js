import React, { useEffect, useState } from "react";
import axios from "axios";
import { Users, Clock, TrendingUp, XCircle } from "lucide-react";
import { toast } from "sonner";

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

  const fetchData = async () => {
    try {
      setLoading(true);
      const [metricsRes, referralsRes] = await Promise.all([
        axios.get(`${API}/metrics`),
        axios.get(`${API}/referrals?status=pending`),
      ]);

      setMetrics(metricsRes.data);
      setReferrals(referralsRes.data);
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
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {referrals.map((referral) => (
                  <tr
                    key={referral.id}
                    data-testid={`referral-row-${referral.id}`}
                    className="hover:bg-muted/50 transition-colors"
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
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
