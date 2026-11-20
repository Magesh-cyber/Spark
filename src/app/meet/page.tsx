"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Video,
  Phone,
  PhoneCall,
  Calendar,
  Clock,
  User,
  Link2,
  Plus,
  X,
  Search,
  Copy,
  Check,
  Trash2,
  Users,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
  PhoneMissed,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Radio,
} from "lucide-react";
import { ShellLayout } from "@/components/layout/ShellLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/lib/workspace-context";
import {
  getWorkspaceMeetings,
  scheduleWorkspaceMeeting,
  cancelWorkspaceMeeting,
  getWorkspaceMeetingLinks,
  createWorkspaceMeetingLink,
  deleteWorkspaceMeetingLink,
  getWorkspaceCallLogs,
  ScheduledMeetingItem,
  WorkspaceMeetingLinkItem,
  WorkspaceCallLogItem,
} from "@/lib/actions/meetings";
import { getWorkspaceMembers } from "@/lib/actions/workspace-members";
import { WorkspaceMemberItem } from "@/lib/types";
import { VideoRoomModal } from "@/components/meet/VideoRoomModal";

function MeetPageContent() {
  const { activeWorkspace, currentUser } = useWorkspace();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Active sub-sidebar tab: "calls" | "schedule" | "links"
  const urlTab = searchParams.get("tab") as "calls" | "schedule" | "links" | null;
  const [activeTab, setActiveTab] = useState<"calls" | "schedule" | "links">(urlTab || "calls");

  // Data states
  const [meetings, setMeetings] = useState<ScheduledMeetingItem[]>([]);
  const [links, setLinks] = useState<WorkspaceMeetingLinkItem[]>([]);
  const [callLogs, setCallLogs] = useState<WorkspaceCallLogItem[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search filter for team directory
  const [memberSearch, setMemberSearch] = useState("");

  // Video Room Modal state
  const [isRoomOpen, setIsRoomOpen] = useState(false);
  const [currentRoomCode, setCurrentRoomCode] = useState("");
  const [currentRoomTitle, setCurrentRoomTitle] = useState("Meeting Room");
  const [currentCallType, setCurrentCallType] = useState<"VOICE" | "VIDEO">("VIDEO");
  const [currentReceiver, setCurrentReceiver] = useState<{
    id: string;
    fullName: string;
    email?: string;
    avatarUrl?: string | null;
  } | null>(null);

  // Schedule modal state
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [scheduleTitle, setScheduleTitle] = useState("");
  const [scheduleDesc, setScheduleDesc] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleDuration, setScheduleDuration] = useState("30");
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  const [scheduleError, setScheduleError] = useState("");

  // Meeting Link creator state
  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [isCreatingLink, setIsCreatingLink] = useState(false);

  // Join room code input
  const [joinCodeInput, setJoinCodeInput] = useState("");

  // Copied feedback map: key -> boolean
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // 1. Initial Data Fetching
  const loadAllData = useCallback(async () => {
    if (!activeWorkspace?.id || activeWorkspace.id === "personal-fallback") {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    try {
      const [meetRes, linkRes, logRes, memberRes] = await Promise.all([
        getWorkspaceMeetings(activeWorkspace.id),
        getWorkspaceMeetingLinks(activeWorkspace.id),
        getWorkspaceCallLogs(activeWorkspace.id),
        getWorkspaceMembers(activeWorkspace.id),
      ]);

      if (meetRes.success) setMeetings(meetRes.meetings);
      if (linkRes.success) setLinks(linkRes.links);
      if (logRes.success) setCallLogs(logRes.callLogs);
      if (!memberRes.error) setMembers(memberRes.members);
    } catch (err) {
      console.error("Failed to load meetings data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspace?.id]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // 2. Handle URL Room parameter (?room=spk-...)
  useEffect(() => {
    const roomFromUrl = searchParams.get("room");
    if (roomFromUrl && !isRoomOpen) {
      setCurrentRoomCode(roomFromUrl);
      setCurrentRoomTitle(`Meeting [${roomFromUrl}]`);
      setCurrentCallType("VIDEO");
      setCurrentReceiver(null);
      setIsRoomOpen(true);
    }
  }, [searchParams, isRoomOpen]);

  // Sync tab with URL if changed
  const handleTabChange = (tab: "calls" | "schedule" | "links") => {
    setActiveTab(tab);
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set("tab", tab);
    router.replace(`/meet?${newParams.toString()}`);
  };

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Launch direct 1-on-1 call
  const startDirectCall = (
    targetUser: { id: string; fullName: string; email?: string; avatarUrl?: string | null },
    type: "VOICE" | "VIDEO"
  ) => {
    const uniqueRoom = `call-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 6)}`;
    setCurrentRoomCode(uniqueRoom);
    setCurrentRoomTitle(`${type === "VIDEO" ? "Video Call" : "Voice Call"} with ${targetUser.fullName}`);
    setCurrentCallType(type);
    setCurrentReceiver(targetUser);
    setIsRoomOpen(true);
  };

  // Launch instant meeting
  const startInstantMeeting = async () => {
    if (!activeWorkspace?.id) return;
    const instantCode = `inst-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 6)}`;

    try {
      const res = await createWorkspaceMeetingLink({
        workspaceId: activeWorkspace.id,
        title: "Instant Collaboration Huddle",
        roomCode: instantCode,
        isInstant: true,
      });
      if (res.success && res.link) {
        setLinks((prev) => [res.link!, ...prev]);
      }
    } catch (e) {
      console.warn("Could not save instant link to DB:", e);
    }

    setCurrentRoomCode(instantCode);
    setCurrentRoomTitle("Instant Collaboration Huddle");
    setCurrentCallType("VIDEO");
    setCurrentReceiver(null);
    setIsRoomOpen(true);
  };

  // Join Room by Code
  const handleJoinWithCode = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = joinCodeInput.trim().replace(/^.*room=/, "");
    if (!clean) return;

    setCurrentRoomCode(clean);
    setCurrentRoomTitle(`Room [${clean}]`);
    setCurrentCallType("VIDEO");
    setCurrentReceiver(null);
    setIsRoomOpen(true);
    setJoinCodeInput("");
  };

  // Schedule a new meeting
  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleTitle.trim() || !scheduleDate || !scheduleTime) {
      setScheduleError("Title, date, and time are required.");
      return;
    }

    setScheduleSubmitting(true);
    setScheduleError("");

    try {
      const startDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
      const durationMinutes = parseInt(scheduleDuration, 10) || 30;
      const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60 * 1000);

      const res = await scheduleWorkspaceMeeting({
        workspaceId: activeWorkspace.id,
        title: scheduleTitle.trim(),
        description: scheduleDesc.trim() || undefined,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
      });

      if (!res.success) {
        setScheduleError(res.error || "Failed to schedule meeting.");
      } else if (res.meeting) {
        setMeetings((prev) => [...prev, res.meeting!]);
        setIsScheduleOpen(false);
        setScheduleTitle("");
        setScheduleDesc("");
        setScheduleDate("");
        setScheduleTime("");
      }
    } catch {
      setScheduleError("An unexpected error occurred.");
    } finally {
      setScheduleSubmitting(false);
    }
  };

  // Cancel / Delete a scheduled meeting
  const handleCancelMeeting = async (meetingId: string) => {
    if (!confirm("Are you sure you want to cancel this scheduled meeting?")) return;
    try {
      const res = await cancelWorkspaceMeeting(activeWorkspace.id, meetingId);
      if (res.success) {
        setMeetings((prev) => prev.filter((m) => m.id !== meetingId));
      }
    } catch (e) {
      console.error("Failed to cancel meeting:", e);
    }
  };

  // Create permanent reusable link
  const handleCreateMeetingLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLinkTitle.trim()) return;

    setIsCreatingLink(true);
    try {
      const res = await createWorkspaceMeetingLink({
        workspaceId: activeWorkspace.id,
        title: newLinkTitle.trim(),
        isInstant: false,
      });

      if (res.success && res.link) {
        setLinks((prev) => [res.link!, ...prev]);
        setNewLinkTitle("");
      }
    } catch (e) {
      console.error("Failed to create link:", e);
    } finally {
      setIsCreatingLink(false);
    }
  };

  // Delete permanent link
  const handleDeleteLink = async (linkId: string) => {
    if (!confirm("Delete this meeting link?")) return;
    try {
      const res = await deleteWorkspaceMeetingLink(activeWorkspace.id, linkId);
      if (res.success) {
        setLinks((prev) => prev.filter((l) => l.id !== linkId));
      }
    } catch (e) {
      console.error("Failed to delete link:", e);
    }
  };

  // Filter members for directory
  const filteredMembers = members.filter((m) => {
    if (m.userId === currentUser?.id) return false; // exclude self
    const query = memberSearch.toLowerCase();
    return (
      m.user.fullName.toLowerCase().includes(query) ||
      m.user.email.toLowerCase().includes(query)
    );
  });

  const originUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <ShellLayout>
      <div className="flex flex-col space-y-4">
        {/* Top Header */}
        <PageHeader
          title="Meetings & Calls"
          description={`Direct 1-on-1 calling, scheduled calendar meetings, and instant video huddles for ${
            activeWorkspace?.name || "your workspace"
          }.`}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Sparkles className="h-3.5 w-3.5 text-purple-400" />}
                onClick={startInstantMeeting}
              >
                Instant Huddle
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => setIsScheduleOpen(true)}
              >
                Schedule Meeting
              </Button>
            </div>
          }
        />

        {/* 2-Pane Collaboration Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* ========================================================= */}
          {/* LEFT SUB-SIDEBAR: Calls, Schedule a Meeting, Meeting Links */}
          {/* ========================================================= */}
          <aside className="lg:col-span-3 rounded-[12px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-3.5 shadow-subtle flex flex-col justify-between space-y-5">
            {/* Nav Tabs */}
            <div className="space-y-1.5">
              <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--spark-text-muted)] flex items-center justify-between">
                <span>Collaboration Hub</span>
                <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  VoIP Ready
                </span>
              </div>

              {/* 1. Calls & Huddles */}
              <button
                onClick={() => handleTabChange("calls")}
                className={`w-full flex items-center justify-between rounded-[8px] px-3 py-2.5 text-left text-xs font-medium transition-all ${
                  activeTab === "calls"
                    ? "bg-[var(--spark-accent)] text-white shadow-sm"
                    : "text-[var(--spark-text-secondary)] hover:bg-[var(--spark-surface-hover)] hover:text-[var(--spark-text-primary)]"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <PhoneCall className="h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-semibold leading-tight">Calls & Huddles</p>
                    <p className={`text-[10px] ${activeTab === "calls" ? "text-white/80" : "text-[var(--spark-text-muted)]"}`}>
                      1-on-1 calls & call logs
                    </p>
                  </div>
                </div>
                <Badge
                  variant={activeTab === "calls" ? "default" : "secondary"}
                  size="sm"
                  className={activeTab === "calls" ? "bg-white/20 text-white" : ""}
                >
                  {members.length > 1 ? members.length - 1 : 0}
                </Badge>
              </button>

              {/* 2. Schedule a Meeting */}
              <button
                onClick={() => handleTabChange("schedule")}
                className={`w-full flex items-center justify-between rounded-[8px] px-3 py-2.5 text-left text-xs font-medium transition-all ${
                  activeTab === "schedule"
                    ? "bg-[var(--spark-accent)] text-white shadow-sm"
                    : "text-[var(--spark-text-secondary)] hover:bg-[var(--spark-surface-hover)] hover:text-[var(--spark-text-primary)]"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-semibold leading-tight">Schedule a Meeting</p>
                    <p className={`text-[10px] ${activeTab === "schedule" ? "text-white/80" : "text-[var(--spark-text-muted)]"}`}>
                      Calendar & upcoming syncs
                    </p>
                  </div>
                </div>
                <Badge
                  variant={activeTab === "schedule" ? "default" : "secondary"}
                  size="sm"
                  className={activeTab === "schedule" ? "bg-white/20 text-white" : ""}
                >
                  {meetings.length}
                </Badge>
              </button>

              {/* 3. Meeting Links */}
              <button
                onClick={() => handleTabChange("links")}
                className={`w-full flex items-center justify-between rounded-[8px] px-3 py-2.5 text-left text-xs font-medium transition-all ${
                  activeTab === "links"
                    ? "bg-[var(--spark-accent)] text-white shadow-sm"
                    : "text-[var(--spark-text-secondary)] hover:bg-[var(--spark-surface-hover)] hover:text-[var(--spark-text-primary)]"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Link2 className="h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-semibold leading-tight">Meeting Links</p>
                    <p className={`text-[10px] ${activeTab === "links" ? "text-white/80" : "text-[var(--spark-text-muted)]"}`}>
                      Instant rooms & codes
                    </p>
                  </div>
                </div>
                <Badge
                  variant={activeTab === "links" ? "default" : "secondary"}
                  size="sm"
                  className={activeTab === "links" ? "bg-white/20 text-white" : ""}
                >
                  {links.length}
                </Badge>
              </button>
            </div>

            {/* Quick Actions in Sidebar */}
            <div className="space-y-3 pt-3 border-t border-[var(--spark-border)]">
              {/* Join with Code Widget */}
              <form onSubmit={handleJoinWithCode} className="space-y-1.5">
                <label className="block text-[11px] font-medium text-[var(--spark-text-primary)]">
                  Join via Room Code
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value)}
                    placeholder="e.g. spk-842a"
                    className="flex-1 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] px-2.5 py-1 text-xs text-[var(--spark-text-primary)] placeholder-[var(--spark-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--spark-accent)]"
                  />
                  <Button type="submit" variant="secondary" size="sm" className="px-2.5 py-1 text-xs">
                    Join
                  </Button>
                </div>
              </form>

              {/* Start Instant Meeting Button */}
              <button
                onClick={startInstantMeeting}
                className="w-full flex items-center justify-center gap-2 rounded-[8px] bg-gradient-to-r from-purple-600 to-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:from-purple-500 hover:to-indigo-500 transition-all"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Start Instant Meeting</span>
              </button>

              {/* Supabase Realtime WebRTC Status Card */}
              <div className="rounded-[8px] bg-[var(--spark-canvas)] p-2.5 border border-[var(--spark-border)] flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-purple-500" />
                  <span className="text-[var(--spark-text-secondary)]">Supabase WebRTC P2P</span>
                </div>
                <span className="text-emerald-500 font-medium">Active</span>
              </div>
            </div>
          </aside>

          {/* ========================================================= */}
          {/* RIGHT MAIN PANE: Content based on activeTab */}
          {/* ========================================================= */}
          <main className="lg:col-span-9 space-y-5">
            {/* ------------------------------------------------------- */}
            {/* TAB 1: CALLS & HUDDLES (1-on-1 directory + call logs)  */}
            {/* ------------------------------------------------------- */}
            {activeTab === "calls" && (
              <div className="space-y-6">
                {/* Stats Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-[10px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-3.5 shadow-subtle">
                    <p className="text-[11px] text-[var(--spark-text-muted)]">Available Teammates</p>
                    <p className="text-xl font-bold text-[var(--spark-text-primary)] mt-1">
                      {members.length > 1 ? members.length - 1 : 0}
                    </p>
                  </div>
                  <div className="rounded-[10px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-3.5 shadow-subtle">
                    <p className="text-[11px] text-[var(--spark-text-muted)]">Total Calls Logged</p>
                    <p className="text-xl font-bold text-[var(--spark-text-primary)] mt-1">{callLogs.length}</p>
                  </div>
                  <div className="rounded-[10px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-3.5 shadow-subtle">
                    <p className="text-[11px] text-[var(--spark-text-muted)]">Encrypted WebRTC Audio & Video</p>
                    <p className="text-xs font-semibold text-emerald-500 mt-2 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Zero Latency Peer Link
                    </p>
                  </div>
                </div>

                {/* Team Members Calling Directory */}
                <div className="rounded-[12px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-4 shadow-subtle space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--spark-border)]">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--spark-text-primary)]">
                        Workspace Team Directory
                      </h3>
                      <p className="text-xs text-[var(--spark-text-secondary)]">
                        Start an instant video or voice call with any colleague in this workspace.
                      </p>
                    </div>

                    <div className="relative w-full sm:w-60">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--spark-text-muted)]" />
                      <input
                        type="text"
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        placeholder="Search member by name..."
                        className="w-full rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] pl-8 pr-3 py-1.5 text-xs text-[var(--spark-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--spark-accent)]"
                      />
                    </div>
                  </div>

                  {filteredMembers.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[var(--spark-text-muted)]">
                      {members.length <= 1
                        ? "No other team members in this workspace yet. Invite teammates to make calls!"
                        : "No team members matched your search."}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {filteredMembers.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between rounded-[10px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] p-3 hover:border-[var(--spark-border-strong)] transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-600/20 text-purple-600 font-semibold text-sm">
                                {m.user.fullName.charAt(0)}
                              </div>
                              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-black" />
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h4 className="text-xs font-semibold text-[var(--spark-text-primary)]">
                                  {m.user.fullName}
                                </h4>
                                <Badge variant="secondary" size="sm" className="text-[9px] px-1.5 py-0">
                                  {m.role}
                                </Badge>
                              </div>
                              <p className="text-[11px] text-[var(--spark-text-muted)]">{m.user.email}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2.5 text-xs text-[var(--spark-accent)] hover:bg-[var(--spark-highlight)]"
                              onClick={() => startDirectCall(m.user, "VOICE")}
                              title="Start Voice Call"
                            >
                              <Phone className="h-3.5 w-3.5 mr-1" />
                              Voice
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              className="h-8 px-2.5 text-xs"
                              onClick={() => startDirectCall(m.user, "VIDEO")}
                              title="Start Video Call"
                            >
                              <Video className="h-3.5 w-3.5 mr-1" />
                              Video
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Call History / Logs Section */}
                <div className="rounded-[12px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-4 shadow-subtle space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[var(--spark-border)]">
                    <h3 className="text-sm font-semibold text-[var(--spark-text-primary)]">
                      Recent Call History & Logs
                    </h3>
                    <span className="text-[11px] text-[var(--spark-text-muted)]">
                      {callLogs.length} total call records
                    </span>
                  </div>

                  {callLogs.length === 0 ? (
                    <div className="py-6 text-center text-xs text-[var(--spark-text-muted)]">
                      No call records yet. Initiate a 1-on-1 voice or video call above to populate logs.
                    </div>
                  ) : (
                    <div className="divide-y divide-[var(--spark-border)]">
                      {callLogs.slice(0, 10).map((log) => {
                        const isCaller = log.callerId === currentUser?.id;
                        const durationMins = Math.floor(log.duration / 60);
                        const durationSecs = log.duration % 60;
                        const formattedDuration = `${durationMins}m ${durationSecs}s`;
                        const dateFormatted = new Date(log.startedAt).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        });

                        return (
                          <div key={log.id} className="flex items-center justify-between py-2.5 text-xs">
                            <div className="flex items-center gap-3">
                              <div
                                className={`flex h-8 w-8 items-center justify-center rounded-full ${
                                  log.type === "VIDEO"
                                    ? "bg-purple-500/10 text-purple-600"
                                    : "bg-blue-500/10 text-blue-600"
                                }`}
                              >
                                {log.type === "VIDEO" ? (
                                  <Video className="h-4 w-4" />
                                ) : (
                                  <Phone className="h-4 w-4" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-[var(--spark-text-primary)]">
                                    {isCaller
                                      ? `Called ${log.receiverName || "Team Member"}`
                                      : `Received call from ${log.callerName}`}
                                  </span>
                                  <Badge variant="secondary" size="sm" className="text-[10px] px-1.5 py-0">
                                    {log.type}
                                  </Badge>
                                </div>
                                <p className="text-[11px] text-[var(--spark-text-muted)]">
                                  {dateFormatted} • Code: {log.roomCode}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="font-mono text-xs text-[var(--spark-text-secondary)]">
                                {log.duration > 0 ? formattedDuration : "Ended"}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => {
                                  setCurrentRoomCode(log.roomCode);
                                  setCurrentRoomTitle(`Call Back [${log.roomCode}]`);
                                  setCurrentCallType(log.type);
                                  setIsRoomOpen(true);
                                }}
                              >
                                Call Back
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ------------------------------------------------------- */}
            {/* TAB 2: SCHEDULE A MEETING (Calendar syncs & manager)     */}
            {/* ------------------------------------------------------- */}
            {activeTab === "schedule" && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--spark-text-primary)]">
                      Scheduled Workspace Meetings
                    </h3>
                    <p className="text-xs text-[var(--spark-text-secondary)]">
                      Plan team syncs, sprint reviews, and calendar events with direct room join links.
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Plus className="h-3.5 w-3.5" />}
                    onClick={() => setIsScheduleOpen(true)}
                  >
                    Schedule Meeting
                  </Button>
                </div>

                {meetings.length === 0 ? (
                  <div className="rounded-[10px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-8">
                    <EmptyState
                      icon={<Calendar className="h-6 w-6" />}
                      title="No scheduled meetings"
                      description="Upcoming team calls and syncs scheduled in this workspace will appear here."
                      actionLabel="Schedule First Call"
                      onAction={() => setIsScheduleOpen(true)}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {meetings.map((m) => {
                      const dateObj = new Date(m.startTime);
                      const isPast = dateObj.getTime() < Date.now();
                      const roomCode = m.roomCode || `spk-${m.id.substring(0, 8)}`;
                      const meetUrl = `${originUrl}/meet?room=${roomCode}`;

                      return (
                        <div
                          key={m.id}
                          className="rounded-[12px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-4 shadow-subtle hover:border-[var(--spark-border-strong)] transition-all flex flex-col justify-between space-y-3"
                        >
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[var(--spark-highlight)] text-[var(--spark-accent)]">
                                  <Video className="h-4 w-4" />
                                </div>
                                <h4 className="text-sm font-semibold text-[var(--spark-text-primary)] line-clamp-1">
                                  {m.title}
                                </h4>
                              </div>
                              <Badge variant={isPast ? "default" : "violet"} size="sm">
                                {isPast ? "Concluded" : "Upcoming"}
                              </Badge>
                            </div>

                            {m.description && (
                              <p className="text-xs text-[var(--spark-text-secondary)] line-clamp-2">
                                {m.description}
                              </p>
                            )}
                          </div>

                          <div className="border-t border-[var(--spark-border)] pt-3 space-y-2 text-xs text-[var(--spark-text-secondary)]">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5 text-[var(--spark-accent)]" />
                                <span>
                                  {dateObj.toLocaleDateString(undefined, {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 text-[var(--spark-accent)]" />
                                <span>
                                  {dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-[var(--spark-text-muted)]">
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {m.creatorName}
                              </span>
                              <span className="font-mono bg-[var(--spark-canvas)] px-1.5 py-0.5 rounded border border-[var(--spark-border)]">
                                {roomCode}
                              </span>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center justify-between pt-2 border-t border-[var(--spark-border)] gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs px-2"
                                onClick={() => handleCopy(meetUrl, `meet-${m.id}`)}
                              >
                                {copiedKey === `meet-${m.id}` ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-500 mr-1" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5 mr-1" />
                                )}
                                {copiedKey === `meet-${m.id}` ? "Copied" : "Copy Link"}
                              </Button>

                              <div className="flex items-center gap-1">
                                <Button
                                  variant="primary"
                                  size="sm"
                                  className="h-7 text-xs px-2.5"
                                  onClick={() => {
                                    setCurrentRoomCode(roomCode);
                                    setCurrentRoomTitle(m.title);
                                    setCurrentCallType("VIDEO");
                                    setIsRoomOpen(true);
                                  }}
                                >
                                  Join Room
                                </Button>
                                <button
                                  type="button"
                                  onClick={() => handleCancelMeeting(m.id)}
                                  className="p-1.5 rounded text-[var(--spark-text-muted)] hover:text-red-500 transition-colors"
                                  title="Cancel meeting"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ------------------------------------------------------- */}
            {/* TAB 3: MEETING LINKS (Instant rooms & permanent links)   */}
            {/* ------------------------------------------------------- */}
            {activeTab === "links" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-[var(--spark-text-primary)]">
                    Meeting Links & Persistent Rooms
                  </h3>
                  <p className="text-xs text-[var(--spark-text-secondary)]">
                    Generate permanent room links for ongoing project syncs, design reviews, or quick ad-hoc meetings.
                  </p>
                </div>

                {/* 3 Quick Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Card 1: Start Instant Meeting */}
                  <div className="rounded-[12px] border border-[var(--spark-border)] bg-gradient-to-br from-purple-900/10 to-indigo-900/10 p-5 shadow-subtle space-y-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-purple-600 text-white shadow-md">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-[var(--spark-text-primary)]">
                          Start an Instant Meeting
                        </h4>
                        <p className="text-xs text-[var(--spark-text-secondary)]">
                          Create a meeting room right now and invite others with a link.
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={startInstantMeeting}
                      className="w-full bg-purple-600 hover:bg-purple-700"
                    >
                      Start Instant Meeting
                    </Button>
                  </div>

                  {/* Card 2: Create Link for Later */}
                  <form
                    onSubmit={handleCreateMeetingLink}
                    className="rounded-[12px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-5 shadow-subtle space-y-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[var(--spark-highlight)] text-[var(--spark-accent)]">
                        <Link2 className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-[var(--spark-text-primary)]">
                          Create Reusable Room Link
                        </h4>
                        <p className="text-xs text-[var(--spark-text-secondary)]">
                          Name a permanent room (e.g. Daily Standup).
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        required
                        value={newLinkTitle}
                        onChange={(e) => setNewLinkTitle(e.target.value)}
                        placeholder="e.g. Design Critique Room"
                        className="flex-1 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] px-3 py-1.5 text-xs text-[var(--spark-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--spark-accent)]"
                      />
                      <Button type="submit" variant="primary" size="sm" isLoading={isCreatingLink}>
                        Create
                      </Button>
                    </div>
                  </form>
                </div>

                {/* Saved Links Library */}
                <div className="rounded-[12px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-4 shadow-subtle space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-[var(--spark-border)]">
                    <h4 className="text-sm font-semibold text-[var(--spark-text-primary)]">
                      Active Meeting Links Directory
                    </h4>
                    <span className="text-xs text-[var(--spark-text-muted)]">{links.length} total links</span>
                  </div>

                  {links.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[var(--spark-text-muted)]">
                      No meeting links generated yet. Create a reusable room link or instant meeting above.
                    </div>
                  ) : (
                    <div className="divide-y divide-[var(--spark-border)]">
                      {links.map((link) => {
                        const fullUrl = `${originUrl}/meet?room=${link.roomCode}`;
                        return (
                          <div key={link.id} className="flex items-center justify-between py-3 text-xs">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[var(--spark-highlight)] text-[var(--spark-accent)]">
                                <Link2 className="h-4 w-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-[var(--spark-text-primary)]">
                                    {link.title}
                                  </span>
                                  <Badge
                                    variant={link.isInstant ? "default" : "violet"}
                                    size="sm"
                                    className="text-[9px] px-1.5 py-0"
                                  >
                                    {link.isInstant ? "Instant" : "Permanent"}
                                  </Badge>
                                </div>
                                <p className="text-[11px] text-[var(--spark-text-muted)]">
                                  Room Code:{" "}
                                  <span className="font-mono font-medium text-[var(--spark-text-primary)]">
                                    {link.roomCode}
                                  </span>{" "}
                                  • Created by {link.creatorName}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2.5 text-xs"
                                onClick={() => handleCopy(fullUrl, `link-${link.id}`)}
                              >
                                {copiedKey === `link-${link.id}` ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-500 mr-1" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5 mr-1" />
                                )}
                                {copiedKey === `link-${link.id}` ? "Copied" : "Copy Link"}
                              </Button>

                              <Button
                                variant="primary"
                                size="sm"
                                className="h-7 px-3 text-xs"
                                onClick={() => {
                                  setCurrentRoomCode(link.roomCode);
                                  setCurrentRoomTitle(link.title);
                                  setCurrentCallType("VIDEO");
                                  setIsRoomOpen(true);
                                }}
                              >
                                Join
                              </Button>

                              <button
                                type="button"
                                onClick={() => handleDeleteLink(link.id)}
                                className="p-1 rounded text-[var(--spark-text-muted)] hover:text-red-500 transition-colors ml-1"
                                title="Delete link"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Schedule Meeting Modal */}
        {isScheduleOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-[#0D0B14]/60 backdrop-blur-sm"
              onClick={() => setIsScheduleOpen(false)}
            />
            <div className="relative z-10 w-full max-w-md rounded-[12px] border spark-glass bg-[var(--spark-surface)] p-6 shadow-modal">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--spark-border)]">
                <h3 className="text-sm font-semibold text-[var(--spark-text-primary)]">
                  Schedule Workspace Meeting
                </h3>
                <button
                  type="button"
                  onClick={() => setIsScheduleOpen(false)}
                  className="rounded p-1 text-[var(--spark-text-muted)] hover:text-[var(--spark-text-primary)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {scheduleError && (
                <div className="mt-3 flex items-center gap-2 rounded-[6px] border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{scheduleError}</span>
                </div>
              )}

              <form onSubmit={handleScheduleSubmit} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-[var(--spark-text-primary)] mb-1">
                    Meeting Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={scheduleTitle}
                    onChange={(e) => setScheduleTitle(e.target.value)}
                    placeholder="e.g. Weekly Product Sync"
                    className="w-full rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] px-3 py-1.5 text-xs text-[var(--spark-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--spark-accent)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--spark-text-primary)] mb-1">
                    Agenda / Description
                  </label>
                  <textarea
                    rows={2}
                    value={scheduleDesc}
                    onChange={(e) => setScheduleDesc(e.target.value)}
                    placeholder="Meeting topics, preparation details..."
                    className="w-full rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] px-3 py-1.5 text-xs text-[var(--spark-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--spark-accent)]"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-[var(--spark-text-primary)] mb-1">
                      Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="w-full rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] px-2.5 py-1.5 text-xs text-[var(--spark-text-primary)] focus:outline-none"
                    />
                  </div>

                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-[var(--spark-text-primary)] mb-1">
                      Time *
                    </label>
                    <input
                      type="time"
                      required
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="w-full rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] px-2.5 py-1.5 text-xs text-[var(--spark-text-primary)] focus:outline-none"
                    />
                  </div>

                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-[var(--spark-text-primary)] mb-1">
                      Duration
                    </label>
                    <select
                      value={scheduleDuration}
                      onChange={(e) => setScheduleDuration(e.target.value)}
                      className="w-full rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] px-2.5 py-1.5 text-xs text-[var(--spark-text-primary)] focus:outline-none"
                    >
                      <option value="15">15 mins</option>
                      <option value="30">30 mins</option>
                      <option value="45">45 mins</option>
                      <option value="60">1 hour</option>
                      <option value="90">1.5 hours</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--spark-border)]">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsScheduleOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={scheduleSubmitting}
                  >
                    Schedule & Notify Members
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Live Interactive Video & Audio Call Room Modal */}
        <VideoRoomModal
          isOpen={isRoomOpen}
          onClose={() => {
            setIsRoomOpen(false);
            loadAllData();
          }}
          workspaceId={activeWorkspace?.id || ""}
          roomCode={currentRoomCode}
          roomTitle={currentRoomTitle}
          callType={currentCallType}
          currentUser={currentUser}
          receiver={currentReceiver}
          onCallEnded={loadAllData}
        />
      </div>
    </ShellLayout>
  );
}

export default function MeetPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-[var(--spark-text-muted)]">Loading meetings...</div>}>
      <MeetPageContent />
    </Suspense>
  );
}
