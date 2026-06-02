export type Role = "admin" | "staff";
export type ServerStatus = "new" | "support";
export type Priority = "low" | "med" | "high";

export interface User {
  id: number;
  name: string;
  email: string;
  position: string;
  avatar_color: string;
  role: Role;
  is_founder: boolean;
  is_active: boolean;
  last_seen: string | null;
  created_at: string;
}

export interface UserWithStats extends User {
  total_bots: number;
  new_bots: number;
  support_bots: number;
  department_ids: number[];
  is_online: boolean;       // computed: last_seen < 5min
  last_seen_label: string | null;  // "5 мин назад"
}

export interface Department {
  id: number;
  name: string;
  slug: string;
  icon: string;
  admin_only: boolean;
  kind: string;
  content: string;
  embed_url: string;
}

export interface Server {
  id: number;
  company: string;
  status: ServerStatus;
  connected_at: string | null;
  notes: string;
  owner_id: number | null;
  owner: User | null;
  created_at: string;
}

export interface BoardColumn {
  id: number;
  name: string;
  color: string;
  position: number;
  is_done: boolean;
}

export interface Board {
  id: number;
  name: string;
  kind: string;
  owner_id: number | null;
  department_id: number | null;
  columns: BoardColumn[];
}

export interface Task {
  id: number;
  title: string;
  description: string;
  tag: string;
  tag_color: string;
  priority: Priority;
  due_date: string | null;
  completed_at: string | null;
  position: number;
  board_id: number;
  column_id: number | null;
  owner_id: number | null;
  owner: User | null;
  requester_id: number | null;
  requester: User | null;
  assignee_ids: number[];
  task_type: string;
  created_at: string;
}

export interface ColumnDef {
  id: number;
  key: string;
  label: string;
  kind: string;
  position: number;
}

export interface SalesRecord {
  id: number;
  user_id: number | null;
  record_date: string;
  metrics: Record<string, any>;
  user: User | null;
}

export interface MarketingRecord {
  id: number;
  user_id: number | null;
  record_date: string;
  fields: Record<string, any>;
  user: User | null;
}

export const STATUS_LABELS: Record<ServerStatus, string> = {
  new: "Новый бот",
  support: "Тех поддержка",
};

export const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "low", label: "Низкий" },
  { value: "med", label: "Средний" },
  { value: "high", label: "Высокий" },
];

export const STATUS_OPTIONS: { value: ServerStatus; label: string }[] = [
  { value: "new", label: "Новый бот" },
  { value: "support", label: "Тех поддержка" },
];

// Tag color presets for tasks
export const TAG_COLORS: { value: string; label: string; bg: string; fg: string }[] = [
  { value: "indigo", label: "Индиго", bg: "var(--primary-dim)", fg: "var(--primary)" },
  { value: "green", label: "Зелёный", bg: "var(--green-bg)", fg: "var(--green)" },
  { value: "orange", label: "Оранжевый", bg: "var(--orange-bg)", fg: "var(--orange)" },
  { value: "yellow", label: "Жёлтый", bg: "rgba(202,138,4,0.12)", fg: "var(--yellow)" },
  { value: "red", label: "Красный", bg: "var(--red-bg)", fg: "var(--red)" },
];

export const AVATAR_COLORS: Record<string, { bg: string; fg: string }> = {
  indigo: { bg: "rgba(70,72,212,0.16)", fg: "#4648d4" },
  green: { bg: "rgba(22,163,74,0.15)", fg: "#16a34a" },
  orange: { bg: "rgba(181,93,0,0.15)", fg: "#b55d00" },
  yellow: { bg: "rgba(202,138,4,0.15)", fg: "#ca8a04" },
  red: { bg: "rgba(186,26,26,0.12)", fg: "#ba1a1a" },
};

export function tagColorStyle(color: string) {
  return TAG_COLORS.find((c) => c.value === color) ?? TAG_COLORS[0];
}

// ===== Meetings =====
export type MeetingStatus = "scheduled" | "closed" | "minus" | "push" | "rescheduled";

export interface Meeting {
  id: number;
  closer_id: number | null;
  setter_id: number | null;
  meeting_date: string;
  address: string;
  client_name: string;
  client_phone: string;
  status: MeetingStatus;
  notes: string;
  parent_id: number | null;
  created_at: string;
  closer: User | null;
  setter: User | null;
  sub_meetings: Meeting[];
}

export const MEETING_STATUS: Record<MeetingStatus, { label: string; color: string; bg: string }> = {
  scheduled:  { label: "Запланирована", color: "var(--primary)",  bg: "var(--primary-dim)" },
  closed:     { label: "Закрыт",        color: "var(--green)",    bg: "var(--green-bg)" },
  minus:      { label: "Минус",         color: "var(--red)",      bg: "var(--red-bg)" },
  push:       { label: "Дожим",         color: "var(--yellow)",   bg: "rgba(202,138,4,0.12)" },
  rescheduled:{ label: "Перенёс",       color: "var(--text3)",    bg: "var(--bg3)" },
};

export interface SalesSummary {
  setters: { user: User | null; totals: Record<string, number> }[];
  closers: { user: User | null; counts: Record<string, number>; total: number }[];
  col_defs: { key: string; label: string }[];
}
