import type {
  User, UserWithStats, Server, Task, Department, Board, BoardColumn,
  ServerStatus, ColumnDef, SalesRecord, MarketingRecord,
} from "./types";

const TOKEN_KEY = "nevodevs_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string) { localStorage.setItem(TOKEN_KEY, t); }
export function clearToken() { localStorage.removeItem(TOKEN_KEY); }

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`/api${path}`, { ...options, headers });
  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Ошибка запроса" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  async login(email: string, password: string): Promise<string> {
    const body = new URLSearchParams({ username: email, password });
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Ошибка входа" }));
      throw new Error(err.detail || "Неверный email или пароль");
    }
    const data = await res.json();
    setToken(data.access_token);
    return data.access_token;
  },
  me: () => request<User>("/auth/me"),
  logout: () => request<void>("/auth/logout", { method: "POST" }),

  // users
  listUsers: (deptId?: number, includeArchived = false) => {
    const p = new URLSearchParams();
    if (deptId) p.set("department_id", String(deptId));
    if (includeArchived) p.set("include_archived", "true");
    const qs = p.toString();
    return request<UserWithStats[]>(`/users${qs ? "?" + qs : ""}`);
  },
  getUser: (id: number) => request<UserWithStats>(`/users/${id}`),
  createUser: (data: any) => request<User>("/users", { method: "POST", body: JSON.stringify(data) }),
  updateUser: (id: number, data: any) => request<User>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteUser: (id: number) => request<void>(`/users/${id}`, { method: "DELETE" }),
  archiveUser: (id: number) => request<any>(`/users/${id}/archive`, { method: "POST" }),
  restoreUser: (id: number) => request<any>(`/users/${id}/restore`, { method: "POST" }),
  reassignBots: (fromId: number, toId: number) => request<any>(`/users/${fromId}/reassign-bots?new_owner_id=${toId}`, { method: "POST" }),
  userBotsCount: (id: number) => request<{ count: number }>(`/users/${id}/bots-count`),

  // departments
  listDepartments: () => request<Department[]>("/departments"),
  getDepartment: (slug: string) => request<Department>(`/departments/${slug}`),
  updateDepartment: (id: number, data: any) => request<Department>(`/departments/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  // servers
  listServers: (filters?: { status?: ServerStatus; owner_id?: number }) => {
    const p = new URLSearchParams();
    if (filters?.status) p.set("status", filters.status);
    if (filters?.owner_id) p.set("owner_id", String(filters.owner_id));
    const qs = p.toString();
    return request<Server[]>(`/servers${qs ? "?" + qs : ""}`);
  },
  createServer: (data: any) => request<Server>("/servers", { method: "POST", body: JSON.stringify(data) }),
  updateServer: (id: number, data: any) => request<Server>(`/servers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteServer: (id: number) => request<void>(`/servers/${id}`, { method: "DELETE" }),

  // boards
  getPersonalBoard: (userId: number) => request<Board>(`/boards/personal/${userId}`),
  getBoard: (id: number) => request<Board>(`/boards/${id}`),
  boardsForDepartment: (deptId: number) => request<Board[]>(`/boards/by-department/${deptId}`),
  addColumn: (boardId: number, data: { name: string; color?: string; is_done?: boolean }) =>
    request<BoardColumn>(`/boards/${boardId}/columns`, { method: "POST", body: JSON.stringify(data) }),
  updateColumn: (colId: number, data: any) => request<BoardColumn>(`/boards/columns/${colId}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteColumn: (colId: number) => request<void>(`/boards/columns/${colId}`, { method: "DELETE" }),

  // tasks
  listTasks: (boardId: number) => request<Task[]>(`/tasks?board_id=${boardId}`),
  createTask: (data: any) => request<Task>("/tasks", { method: "POST", body: JSON.stringify(data) }),
  updateTask: (id: number, data: any) => request<Task>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  moveTask: (id: number, column_id: number, position: number) =>
    request<Task>(`/tasks/${id}/move`, { method: "PATCH", body: JSON.stringify({ column_id, position }) }),
  completeTask: (id: number) => request<Task>(`/tasks/${id}/complete`, { method: "PATCH" }),
  deleteTask: (id: number) => request<void>(`/tasks/${id}`, { method: "DELETE" }),

  // sales
  salesColumns: () => request<ColumnDef[]>("/sales/columns"),
  addSalesColumn: (data: { label: string; kind?: string }) => request<ColumnDef>("/sales/columns", { method: "POST", body: JSON.stringify(data) }),
  deleteSalesColumn: (id: number) => request<void>(`/sales/columns/${id}`, { method: "DELETE" }),
  salesRecords: (f?: { user_id?: number; date_from?: string; date_to?: string }) => {
    const p = new URLSearchParams();
    if (f?.user_id) p.set("user_id", String(f.user_id));
    if (f?.date_from) p.set("date_from", f.date_from);
    if (f?.date_to) p.set("date_to", f.date_to);
    const qs = p.toString();
    return request<SalesRecord[]>(`/sales/records${qs ? "?" + qs : ""}`);
  },
  createSalesRecord: (data: any) => request<SalesRecord>("/sales/records", { method: "POST", body: JSON.stringify(data) }),
  updateSalesRecord: (id: number, data: any) => request<SalesRecord>(`/sales/records/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteSalesRecord: (id: number) => request<void>(`/sales/records/${id}`, { method: "DELETE" }),

  // marketing
  marketingColumns: () => request<ColumnDef[]>("/marketing/columns"),
  addMarketingColumn: (data: { label: string; kind?: string }) => request<ColumnDef>("/marketing/columns", { method: "POST", body: JSON.stringify(data) }),
  deleteMarketingColumn: (id: number) => request<void>(`/marketing/columns/${id}`, { method: "DELETE" }),
  marketingRecords: (f?: { date_from?: string; date_to?: string }) => {
    const p = new URLSearchParams();
    if (f?.date_from) p.set("date_from", f.date_from);
    if (f?.date_to) p.set("date_to", f.date_to);
    const qs = p.toString();
    return request<MarketingRecord[]>(`/marketing/records${qs ? "?" + qs : ""}`);
  },
  createMarketingRecord: (data: any) => request<MarketingRecord>("/marketing/records", { method: "POST", body: JSON.stringify(data) }),
  updateMarketingRecord: (id: number, data: any) => request<MarketingRecord>(`/marketing/records/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteMarketingRecord: (id: number) => request<void>(`/marketing/records/${id}`, { method: "DELETE" }),

  // sales column reorder
  reorderSalesColumn: (id: number, direction: "left" | "right") =>
    request<any>(`/sales/columns/${id}/position?direction=${direction}`, { method: "PATCH" }),
};

// search
export const searchApi = {
  search: (q: string) => request<{ users: any[]; servers: any[]; tasks: any[] }>(`/search?q=${encodeURIComponent(q)}`),
};

// notifications
export const notifApi = {
  get: () => request<{ count: number; items: any[] }>("/notifications"),
};

// meetings
export const meetingApi = {
  list: (f?: { closer_id?: number; year?: number; month?: number; date_from?: string; date_to?: string; offset?: number; limit?: number }) => {
    const p = new URLSearchParams();
    if (f?.closer_id) p.set("closer_id", String(f.closer_id));
    if (f?.year)   p.set("year",   String(f.year));
    if (f?.month)  p.set("month",  String(f.month));
    if (f?.date_from) p.set("date_from", f.date_from);
    if (f?.date_to)   p.set("date_to",   f.date_to);
    if (f?.offset) p.set("offset", String(f.offset));
    if (f?.limit)  p.set("limit",  String(f.limit));
    const qs = p.toString();
    return request<import("./types").Meeting[]>(`/meetings${qs ? "?" + qs : ""}`);
  },
  get: (id: number) => request<import("./types").Meeting>(`/meetings/${id}`),
  create: (data: any) => request<import("./types").Meeting>("/meetings", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: any) => request<import("./types").Meeting>(`/meetings/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  setStatus: (id: number, status: string) => request<import("./types").Meeting>(`/meetings/${id}/status?status=${status}`, { method: "PATCH" }),
  delete: (id: number) => request<void>(`/meetings/${id}`, { method: "DELETE" }),
  summary: (f?: { date_from?: string; date_to?: string }) => {
    const p = new URLSearchParams();
    if (f?.date_from) p.set("date_from", f.date_from);
    if (f?.date_to)   p.set("date_to",   f.date_to);
    const qs = p.toString();
    return request<import("./types").SalesSummary>(`/meetings/summary/all${qs ? "?" + qs : ""}`);
  },
};
