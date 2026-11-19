"use client";

import React, { useState } from "react";
import { X, ClipboardCheck, AlertTriangle, CheckCircle2, Clock, ListTodo } from "lucide-react";
import { useNexconnChat } from "./NexconnChatProvider";
import { HandoverReportData } from "./types";

interface ShiftHandoverModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_SHIFTS = [
  "Morning Shift (08:00 – 16:00)",
  "Evening Shift (16:00 – 00:00)",
  "Night Shift (00:00 – 08:00)",
  "Weekend On-Call Shift",
];

export function ShiftHandoverModal({ isOpen, onClose }: ShiftHandoverModalProps) {
  const { activeConversation, sendHandoverReport } = useNexconnChat();

  const [shiftPeriod, setShiftPeriod] = useState<string>(PRESET_SHIFTS[0]);
  const [customShift, setCustomShift] = useState<string>("");
  const [completed, setCompleted] = useState<string>("");
  const [inProgress, setInProgress] = useState<string>("");
  const [blockers, setBlockers] = useState<string>("");
  const [nextSteps, setNextSteps] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !activeConversation) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const period = customShift.trim() || shiftPeriod;

    if (!period) {
      setError("Please select or enter a shift period.");
      return;
    }
    if (!completed.trim()) {
      setError("Please describe the work completed during this shift.");
      return;
    }
    if (!nextSteps.trim()) {
      setError("Please specify instructions or next steps for the incoming shift.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const payload: HandoverReportData = {
        shiftPeriod: period,
        completed: completed.trim(),
        inProgress: inProgress.trim() || "All scheduled tasks completed.",
        blockers: blockers.trim() || "No critical blockers reported.",
        nextSteps: nextSteps.trim(),
      };

      const success = await sendHandoverReport(payload);
      if (success) {
        onClose();
        // Reset form
        setCompleted("");
        setInProgress("");
        setBlockers("");
        setNextSteps("");
        setCustomShift("");
      } else {
        setError("Failed to broadcast shift handover report. Please try again.");
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D0B14]/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-[14px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-6 shadow-modal max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--spark-border)]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--spark-highlight)] text-[var(--spark-accent)]">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--spark-text-primary)]">
                Create Shift Handover Report
              </h3>
              <p className="text-xs text-[var(--spark-text-secondary)]">
                Posting to #{activeConversation.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-[6px] text-[var(--spark-text-secondary)] hover:text-[var(--spark-text-primary)] hover:bg-[var(--spark-surface-subtle)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-2.5 rounded-[8px] bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Shift Period Selector */}
          <div>
            <label className="block text-xs font-semibold text-[var(--spark-text-primary)] mb-1.5">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-[var(--spark-accent)]" />
                Shift Period
              </span>
            </label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {PRESET_SHIFTS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setShiftPeriod(preset);
                    setCustomShift("");
                  }}
                  className={`px-2.5 py-1.5 text-left text-[11px] rounded-[6px] border transition-colors ${
                    shiftPeriod === preset && !customShift
                      ? "border-[var(--spark-accent)] bg-[var(--spark-highlight)] text-[var(--spark-accent)] font-medium"
                      : "border-[var(--spark-border)] bg-[var(--spark-canvas)] text-[var(--spark-text-secondary)] hover:border-[var(--spark-border-hover)]"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Or enter custom shift name (e.g., APAC Operations Shift)..."
              value={customShift}
              onChange={(e) => setCustomShift(e.target.value)}
              className="w-full px-3 py-1.5 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] text-xs text-[var(--spark-text-primary)] placeholder:text-[var(--spark-text-muted)] focus:outline-none focus:border-[var(--spark-accent)]"
            />
          </div>

          {/* Completed Work */}
          <div>
            <label className="block text-xs font-semibold text-[var(--spark-text-primary)] mb-1">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Work Completed / Accomplishments *
              </span>
            </label>
            <textarea
              rows={2}
              required
              placeholder="• Deployed v2.4 patch to staging&#10;• Resolved 12 customer support escalations&#10;• Backups verified successfully"
              value={completed}
              onChange={(e) => setCompleted(e.target.value)}
              className="w-full px-3 py-2 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] text-xs text-[var(--spark-text-primary)] placeholder:text-[var(--spark-text-muted)] focus:outline-none focus:border-[var(--spark-accent)] resize-none"
            />
          </div>

          {/* In-Progress */}
          <div>
            <label className="block text-xs font-semibold text-[var(--spark-text-primary)] mb-1">
              <span className="flex items-center gap-1.5">
                <ListTodo className="h-3.5 w-3.5 text-blue-500" />
                Ongoing / In-Progress Tasks
              </span>
            </label>
            <textarea
              rows={2}
              placeholder="• Load testing payment endpoints (running until 22:00)&#10;• User onboarding migration at 70%"
              value={inProgress}
              onChange={(e) => setInProgress(e.target.value)}
              className="w-full px-3 py-2 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] text-xs text-[var(--spark-text-primary)] placeholder:text-[var(--spark-text-muted)] focus:outline-none focus:border-[var(--spark-accent)] resize-none"
            />
          </div>

          {/* Blockers & Incidents */}
          <div>
            <label className="block text-xs font-semibold text-[var(--spark-text-primary)] mb-1">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                Critical Blockers & Incidents
              </span>
            </label>
            <textarea
              rows={2}
              placeholder="• Third-party SMS provider 2% elevated error rate&#10;• Ticket #1084 awaiting vendor response"
              value={blockers}
              onChange={(e) => setBlockers(e.target.value)}
              className="w-full px-3 py-2 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] text-xs text-[var(--spark-text-primary)] placeholder:text-[var(--spark-text-muted)] focus:outline-none focus:border-[var(--spark-accent)] resize-none"
            />
          </div>

          {/* Incoming Shift Instructions */}
          <div>
            <label className="block text-xs font-semibold text-[var(--spark-text-primary)] mb-1">
              <span className="flex items-center gap-1.5">
                <ClipboardCheck className="h-3.5 w-3.5 text-[var(--spark-accent)]" />
                Instructions for Incoming Shift *
              </span>
            </label>
            <textarea
              rows={2}
              required
              placeholder="• Check Redis queue depth at 20:00&#10;• Release build v2.4.1 once vendor confirms SMS fix&#10;• Contact Vishal for emergency escalations"
              value={nextSteps}
              onChange={(e) => setNextSteps(e.target.value)}
              className="w-full px-3 py-2 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] text-xs text-[var(--spark-text-primary)] placeholder:text-[var(--spark-text-muted)] focus:outline-none focus:border-[var(--spark-accent)] resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--spark-border)]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-[6px] border border-[var(--spark-border)] text-xs text-[var(--spark-text-secondary)] hover:bg-[var(--spark-surface-subtle)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-[6px] bg-[var(--spark-accent)] text-white text-xs font-medium hover:bg-[var(--spark-accent)]/90 transition-colors disabled:opacity-50"
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              <span>{isSubmitting ? "Publishing..." : "Post Handover Report"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
