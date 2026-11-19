"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { Workspace, User, NotificationItem } from "./types";
import { createClient } from "@/lib/supabase/client";
import { getUserWorkspaces } from "@/lib/actions/workspaces";
import {
  getUserNotifications,
  markNotificationAsRead as markNotificationAsReadServer,
  markAllNotificationsAsRead as markAllNotificationsAsReadServer,
} from "@/lib/actions/notifications";
import {
  prefetchWorkspaceBootstrap,
  subscribeBootstrap,
  getLastBootstrapPayload,
  clearBootstrapMemory,
} from "./bootstrap-client";
import { clearAllClientCaches } from "./client-caches";

interface WorkspaceContextType {
  activeWorkspace: Workspace;
  workspaces: Workspace[];
  setActiveWorkspace: (workspace: Workspace) => void;
  refreshWorkspaces: () => Promise<void>;
  currentUser: User;
  setCurrentUser: (user: User) => void;
  notifications: NotificationItem[];
  unreadNotificationCount: number;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  refreshNotifications: () => Promise<void>;
  addNotification: (item: NotificationItem) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  searchModalOpen: boolean;
  setSearchModalOpen: (open: boolean) => void;
  signOut: () => Promise<void>;
  isLoadingAuth: boolean;
  isLoadingWorkspaces: boolean;
}

const FALLBACK_WORKSPACE: Workspace = {
  id: "personal-fallback",
  name: "Personal Workspace",
  slug: "personal",
  type: "personal",
  role: "OWNER",
};

const INITIAL_NOTIFICATIONS: NotificationItem[] = [];

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const initialBootstrap = getLastBootstrapPayload();

  const [workspaces, setWorkspaces] = useState<Workspace[]>(
    () => initialBootstrap?.workspaces || [FALLBACK_WORKSPACE]
  );
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace>(
    () => initialBootstrap?.activeWorkspace || FALLBACK_WORKSPACE
  );
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(() => !initialBootstrap?.user?.id);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(
    () => !initialBootstrap?.workspaces?.length
  );

  const [currentUser, setCurrentUser] = useState<User>(
    () =>
      initialBootstrap?.user || {
        id: "",
        name: "SPARK User",
        email: "",
        role: "Member",
        title: "Team Member",
      }
  );

  const refreshPromiseRef = useRef<Promise<void> | null>(null);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  // Hydrate immediately from localStorage on mount for 0ms first paint
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (getLastBootstrapPayload()) return;
    try {
      const cachedWsStr = localStorage.getItem("spark_cached_workspaces");
      if (cachedWsStr) {
        const parsedWs: Workspace[] = JSON.parse(cachedWsStr);
        if (Array.isArray(parsedWs) && parsedWs.length > 0) {
          setWorkspaces(parsedWs);
          setIsLoadingWorkspaces(false);
          const persistedId = localStorage.getItem("spark_active_workspace_id");
          const found = parsedWs.find((w) => w.id === persistedId || w.slug === persistedId);
          const personal = parsedWs.find((w) => w.type === "personal" || w.type === "PERSONAL");
          setActiveWorkspace(found || personal || parsedWs[0]);
        }
      }

      const cachedUserStr = localStorage.getItem("spark_cached_user");
      if (cachedUserStr) {
        const parsedUser: User = JSON.parse(cachedUserStr);
        if (parsedUser?.id) {
          setCurrentUser(parsedUser);
          setIsLoadingAuth(false);
        }
      }
    } catch {}
  }, []);

  // Stay synced whenever any bootstrap call resolves (login, mount, workspace switch)
  useEffect(() => {
    return subscribeBootstrap((payload) => {
      if (payload.user?.id) {
        setCurrentUser(payload.user);
        setIsLoadingAuth(false);
      }
      if (payload.workspaces?.length > 0) {
        setWorkspaces(payload.workspaces);
        setIsLoadingWorkspaces(false);
      }
      if (payload.activeWorkspace?.id) {
        setActiveWorkspace(payload.activeWorkspace);
      }
      if (Array.isArray(payload.notifications)) {
        setNotifications(payload.notifications);
      }
    });
  }, []);

  // Load real workspaces from backend (deduplicated)
  const refreshWorkspaces = useCallback(async () => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const task = (async () => {
      try {
        const res = await getUserWorkspaces();
        if (res.workspaces && res.workspaces.length > 0) {
          setWorkspaces(res.workspaces);

          if (typeof window !== "undefined") {
            try {
              localStorage.setItem("spark_cached_workspaces", JSON.stringify(res.workspaces));
            } catch {}
          }

          const persistedId =
            typeof window !== "undefined"
              ? localStorage.getItem("spark_active_workspace_id")
              : null;

          const found = res.workspaces.find(
            (w) => w.id === persistedId || w.slug === persistedId
          );

          if (found) {
            setActiveWorkspace(found);
          } else {
            const personal = res.workspaces.find(
              (w) => w.type === "personal" || w.type === "PERSONAL"
            );
            setActiveWorkspace(personal || res.workspaces[0]);
          }
        }
      } catch (err) {
        console.error("Error refreshing workspaces in WorkspaceProvider:", err);
      } finally {
        setIsLoadingWorkspaces(false);
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = task;
    return task;
  }, []);

  // Optimistic workspace switch + unified background preload of all data for new workspace
  const handleSetActiveWorkspace = useCallback((ws: Workspace) => {
    setActiveWorkspace(ws);
    if (typeof window !== "undefined") {
      localStorage.setItem("spark_active_workspace_id", ws.id);
      document.cookie = `spark_active_workspace_id=${ws.id}; path=/; max-age=31536000; SameSite=Lax`;
    }
    if (ws.id && ws.id !== "personal-fallback") {
      prefetchWorkspaceBootstrap(ws.id, { force: true }).catch(() => {});
    }
  }, []);

  // Fast boot: read local session (0.5ms) -> single /api/bootstrap round-trip (eliminates double WAN auth!)
  const loadSessionAndBootstrap = useCallback(async () => {
    const isAuthRoute = pathnameRef.current?.startsWith("/auth");
    if (isAuthRoute) {
      setIsLoadingAuth(false);
      setIsLoadingWorkspaces(false);
      return;
    }

    try {
      const supabase = createClient();
      // getSession() reads locally from cookies without a 650ms WAN round-trip
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        const u = session.user;
        const fullName =
          u.user_metadata?.full_name ||
          u.user_metadata?.name ||
          u.email?.split("@")[0] ||
          "SPARK User";

        setCurrentUser((prev) =>
          prev.id === u.id
            ? prev
            : {
                id: u.id,
                name: fullName,
                email: u.email || "",
                role: "Workspace Owner",
                title: "Account Owner",
                avatarUrl: u.user_metadata?.avatar_url,
              }
        );
        setIsLoadingAuth(false);

        const persistedId =
          typeof window !== "undefined"
            ? localStorage.getItem("spark_active_workspace_id") || undefined
            : undefined;

        // One single round-trip hydrates workspaces + dashboard + teams + chat channels + DMs + Nexconn token
        const payload = await prefetchWorkspaceBootstrap(persistedId);
        if (!payload) {
          // Fallback to server action if bootstrap fails
          await refreshWorkspaces();
        }
      }
    } catch (err) {
      console.error("Error bootstrapping session in WorkspaceProvider:", err);
    } finally {
      setIsLoadingAuth(false);
      setIsLoadingWorkspaces(false);
    }
  }, [refreshWorkspaces]);

  useEffect(() => {
    loadSessionAndBootstrap();

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const u = session.user;
        const name =
          u.user_metadata?.full_name ||
          u.user_metadata?.name ||
          u.email?.split("@")[0] ||
          "SPARK User";

        const userObj: User = {
          id: u.id,
          name,
          email: u.email || "",
          role: "Workspace Owner",
          title: "Account Owner",
          avatarUrl: u.user_metadata?.avatar_url,
        };

        setCurrentUser(userObj);
        setIsLoadingAuth(false);

        if (event === "SIGNED_IN") {
          const persistedId =
            typeof window !== "undefined"
              ? localStorage.getItem("spark_active_workspace_id") || undefined
              : undefined;
          await prefetchWorkspaceBootstrap(persistedId);
        }
      } else if (event === "SIGNED_OUT") {
        clearAllClientCaches();
        clearBootstrapMemory();
        setCurrentUser({
          id: "",
          name: "SPARK User",
          email: "",
          role: "Guest",
        });
        setWorkspaces([FALLBACK_WORKSPACE]);
        setActiveWorkspace(FALLBACK_WORKSPACE);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadSessionAndBootstrap]);

  // Real Sign Out implementation with complete cache cleanup
  const signOut = useCallback(async () => {
    try {
      const supabase = createClient();
      clearAllClientCaches();
      clearBootstrapMemory();
      if (typeof window !== "undefined") {
        localStorage.removeItem("spark_active_workspace_id");
        localStorage.removeItem("spark_cached_workspaces");
        localStorage.removeItem("spark_cached_user");
        document.cookie = "spark_active_workspace_id=; path=/; max-age=0";
      }
      await supabase.auth.signOut();
      router.push("/auth/login");
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  }, [router]);

  const unreadNotificationCount = notifications.filter((n) => !n.read).length;

  const refreshNotifications = useCallback(async () => {
    try {
      const res = await getUserNotifications();
      if (res.success && res.notifications) {
        setNotifications(res.notifications);
      }
    } catch (err) {
      console.warn("Failed to refresh notifications:", err);
    }
  }, []);

  const addNotification = useCallback((item: NotificationItem) => {
    setNotifications((prev) => {
      if (prev.some((n) => n.id === item.id)) return prev;
      return [item, ...prev];
    });
  }, []);

  const markNotificationAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    markNotificationAsReadServer(id).catch(() => {});
  }, []);

  const markAllNotificationsAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    markAllNotificationsAsReadServer().catch(() => {});
  }, []);

  // Fetch real notifications whenever active user changes
  useEffect(() => {
    if (currentUser?.id) {
      refreshNotifications();
    }
  }, [currentUser?.id, refreshNotifications]);

  // Keyboard shortcut listener for Global Search (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchModalOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const contextValue = useMemo<WorkspaceContextType>(
    () => ({
      activeWorkspace,
      workspaces,
      setActiveWorkspace: handleSetActiveWorkspace,
      refreshWorkspaces,
      currentUser,
      setCurrentUser,
      notifications,
      unreadNotificationCount,
      markNotificationAsRead,
      markAllNotificationsAsRead,
      refreshNotifications,
      addNotification,
      sidebarOpen,
      setSidebarOpen,
      searchModalOpen,
      setSearchModalOpen,
      signOut,
      isLoadingAuth,
      isLoadingWorkspaces,
    }),
    [
      activeWorkspace,
      workspaces,
      handleSetActiveWorkspace,
      refreshWorkspaces,
      currentUser,
      notifications,
      unreadNotificationCount,
      markNotificationAsRead,
      markAllNotificationsAsRead,
      refreshNotifications,
      addNotification,
      sidebarOpen,
      searchModalOpen,
      signOut,
      isLoadingAuth,
      isLoadingWorkspaces,
    ]
  );

  return (
    <WorkspaceContext.Provider value={contextValue}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
