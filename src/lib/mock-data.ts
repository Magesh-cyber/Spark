/**
 * @deprecated All runtime mock data has been eliminated in Phase 3.5.
 * Fictional users (Alex Morgan, Sarah Chen, David Miller, Elena Rostova) are removed.
 * Data structures are kept for type-level backward compatibility only.
 */

export interface TaskItem {
  id: string;
  title: string;
  project: string;
  priority: "urgent" | "high" | "medium" | "low";
  status: "Backlog" | "To Do" | "In Progress" | "In Review" | "Done";
  dueDate: string;
  assignee: {
    name: string;
    avatar?: string;
  };
}

export interface ProjectItem {
  id: string;
  name: string;
  description: string;
  status: "On Track" | "At Risk" | "Delayed" | "Completed";
  progress: number;
  owner: string;
  team: string;
  dueDate: string;
}

export interface MeetingItem {
  id: string;
  title: string;
  time: string;
  duration: string;
  participants: string[];
  project: string;
}

export const MOCK_TASKS: TaskItem[] = [];
export const MOCK_PROJECTS: ProjectItem[] = [];
export const MOCK_MEETINGS: MeetingItem[] = [];
