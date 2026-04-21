import React, { useState, useEffect } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Phone, Mail, UserCheck, MapPin, Clock as ClockIcon } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const activityIcons = {
  call: Phone,
  "reach out": UserCheck,
  email: Mail,
  visit: MapPin,
  "follow-up": ClockIcon,
};

const ActivityDialog = ({ open, onOpenChange, referral }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [activityType, setActivityType] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open && referral) {
      fetchActivities();
      // Set default date/time to now
      const now = new Date();
      const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setDateTime(localDateTime);
    }
  }, [open, referral]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/referrals/${referral.id}/activities`);
      setActivities(response.data);
    } catch (error) {
      console.error("Error fetching activities:", error);
      toast.error("Failed to load activities");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!activityType) {
      toast.error("Please select activity type");
      return;
    }

    if (!dateTime) {
      toast.error("Please select date and time");
      return;
    }

    if (!notes.trim()) {
      toast.error("Please enter notes");
      return;
    }

    try {
      setSubmitting(true);

      await axios.post(`${API}/referrals/${referral.id}/activities`, {
        activity_type: activityType,
        date_time: new Date(dateTime).toISOString(),
        notes: notes.trim(),
      });

      toast.success("Activity added successfully");

      // Reset form
      setActivityType("");
      setNotes("");
      const now = new Date();
      const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setDateTime(localDateTime);

      // Refresh activities
      fetchActivities();
    } catch (error) {
      console.error("Error creating activity:", error);
      toast.error("Failed to add activity");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  if (!referral) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="activity-dialog">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">
            Referral Activities
          </DialogTitle>
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
          {/* Add Activity Form */}
          <div className="bg-muted/30 rounded-lg border border-border p-4">
            <h3 className="text-lg font-medium mb-4">Add New Activity</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="activity-type">Activity Type *</Label>
                  <Select value={activityType} onValueChange={setActivityType}>
                    <SelectTrigger data-testid="activity-type-select">
                      <SelectValue placeholder="Select activity type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="call">Call</SelectItem>
                      <SelectItem value="reach out">Reach Out</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="visit">Visit</SelectItem>
                      <SelectItem value="follow-up">Follow-up</SelectItem>
                      <SelectItem value="document-scan">Document Scan</SelectItem>
                      <SelectItem value="eligibility-check-completed">Eligibility Check Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date-time">Date & Time *</Label>
                  <Input
                    id="date-time"
                    data-testid="activity-datetime-input"
                    type="datetime-local"
                    value={dateTime}
                    onChange={(e) => setDateTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes *</Label>
                <Textarea
                  id="notes"
                  data-testid="activity-notes-input"
                  placeholder="Enter activity notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <Button
                type="submit"
                data-testid="add-activity-btn"
                disabled={submitting}
                className="w-full md:w-auto"
              >
                {submitting ? "Adding..." : "Add Activity"}
              </Button>
            </form>
          </div>

          {/* Activities Timeline */}
          <div>
            <h3 className="text-lg font-medium mb-4">Activity Timeline</h3>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading activities...</div>
            ) : activities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="no-activities-message">
                No activities yet. Add your first activity above.
              </div>
            ) : (
              <div className="relative" data-testid="activities-timeline">
                {/* Timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

                <div className="space-y-6">
                  {activities.map((activity, index) => {
                    const Icon = activityIcons[activity.activity_type.toLowerCase()] || ClockIcon;
                    return (
                      <div
                        key={activity.id}
                        data-testid={`activity-item-${index}`}
                        className="relative pl-12"
                      >
                        {/* Timeline dot with icon */}
                        <div className="absolute left-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                          <Icon className="w-4 h-4 text-primary-foreground" />
                        </div>

                        {/* Activity content */}
                        <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium text-foreground capitalize">
                              {activity.activity_type}
                            </h4>
                            <span className="text-xs text-muted-foreground">
                              {formatDateTime(activity.date_time)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {activity.notes}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ActivityDialog;
