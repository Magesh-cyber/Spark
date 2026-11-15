"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { Workspace, User, NotificationItem } from "./types";
import { createClient } from "@/lib/supabase/client";
import { getUserWorkspaces } from "@/lib/actions/workspaces";

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
  const [workspaces, setWorkspaces] = useState<Workspace[]>([FALLBACK_WORKSPACE]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace>(FALLBACK_WORKSPACE);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(true);

  const [currentUser, setCurrentUser] = useState<User>({
    id: "",
    name: "SPARK User",
    email: "",
    role: "Member",
    title: "Team Member",
  });

  // Load real workspaces from backend
  const refreshWorkspaces = useCallback(async () => {
    setIsLoadingWorkspaces(true);
    try {
      const res = await getUserWorkspaces();
      if (res.workspaces && res.workspaces.length > 0) {
        setWorkspaces(res.workspaces);

        // Check if there is an active persisted workspace ID
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
          // Default to personal workspace or the first available workspace
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
    }
  }, []);

  // Set active workspace with persistence
  const handleSetActiveWorkspace = useCallback(
    (ws: Workspace) => {
      setActiveWorkspace(ws);
      if (typeof window !== "undefined") {
        localStorage.setItem("spark_active_workspace_id", ws.id);
        document.cookie = `spark_active_workspace_id=${ws.id}; path=/; max-age=31536000; SameSite=Lax`;
      }
    },
    []
  );

  // Load real authenticated user from Supabase
  const loadUser = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const fullName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "SPARK User";

        setCurrentUser({
          id: user.id,
          name: fullName,
          email: user.email || "",
          role: "Workspace Owner",
          title: "Account Owner",
          avatarUrl: user.user_metadata?.avatar_url,
        });

        // After user is verified, load real workspaces
        await refreshWorkspaces();
      }
    } catch (err) {
      console.error("Error loading user in WorkspaceProvider:", err);
    } finally {
      setIsLoadingAuth(false);
    }
  }, [refreshWorkspaces]);

  useEffect(() => {
    loadUser();

    // Listen to Supabase auth events
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

        setCurrentUser({
          id: u.id,
          name,
          email: u.email || "",
          role: "Workspace Owner",
          title: "Account Owner",
          avatarUrl: u.user_metadata?.avatar_url,
        });

        if (event === "SIGNED_IN") {
          await refreshWorkspaces();
        }
      } else if (event === "SIGNED_OUT") {
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
  }, [loadUser, refreshWorkspaces]);

  // Real Sign Out implementation
  const signOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      if (typeof window !== "undefined") {
        localStorage.removeItem("spark_active_workspace_id");
        document.cookie = "spark_active_workspace_id=; path=/; max-age=0";
      }
      router.push("/auth/login");
      router.refresh();
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  };

  const unreadNotificationCount = notifications.filter((n) => !n.read).length;

  const markNotificationAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

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

  return (
    <WorkspaceContext.Provider
      value={{
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
        sidebarOpen,
        setSidebarOpen,
        searchModalOpen,
        setSearchModalOpen,
        signOut,
        isLoadingAuth,
        isLoadingWorkspaces,
      }}
    >
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
