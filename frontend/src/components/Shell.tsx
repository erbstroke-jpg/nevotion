"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useApp } from "@/context/AppContext";
import { api, searchApi, notifApi, bugApi } from "@/lib/api";
import type { Department } from "@/lib/types";
import { Avatar } from "./Avatar";

const NAV_MAIN = [
  { href: "/dashboard", icon: "grid_view", label: "Главная" },
];

export function Shell({ children, title }: { children: React.ReactNode; title?: string }) {
  const { user, loading, isAdmin, isFounder, theme, toggleTheme, logout } = useApp();
  const [departments, setDepartments] = useState<Department[]>([]);
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Search state
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<any>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<any>(null);

  const [bugCount, setBugCount] = useState(0);
  // Notifications state
  const [notifs, setNotifs] = useState<{ count: number; items: any[] }>({ count: 0, items: [] });
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (user) {
      api.listDepartments().then(setDepartments).catch(() => {});
      notifApi.get().then(setNotifs).catch(() => {});
      bugApi.countNew().then((r) => setBugCount(r.count)).catch(() => {});
    }
  }, [user]);

  // Live search with debounce
  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (searchQ.trim().length < 2) { setSearchResults(null); setSearchOpen(false); return; }
    searchTimer.current = setTimeout(async () => {
      try {
        const r = await searchApi.search(searchQ);
        setSearchResults(r);
        setSearchOpen(true);
      } catch {}
    }, 300);
    return () => clearTimeout(searchTimer.current);
  }, [searchQ]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  if (loading || !user) {
    return <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)" }}>Загрузка…</div>;
  }

  const pageTitle = title ?? NAV_MAIN.find((n) => pathname.startsWith(n.href))?.label ?? "NevOcean";
  const totalNotifs = notifs.count;

  function handleSearchSelect(item: any) {
    setSearchOpen(false); setSearchQ("");
    if (item.type === "user") router.push(`/team/${item.id}`);
    else if (item.type === "server") router.push("/dept/dev");
    else if (item.type === "task") {
      if (item.owner_id) router.push(`/team/${item.owner_id}`);
      else router.push("/dept/dev"); // backend queue or QCC task without owner
    }
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* SIDEBAR */}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-logo">N</div>
          <div><div className="brand-name">NevOcean</div><div className="brand-sub">AI Workspace</div></div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-group">
            <div className="nav-group-label">Рабочая область</div>
            {NAV_MAIN.map((item) => (
              <Link key={item.href} href={item.href} className={`nav-link ${pathname.startsWith(item.href) ? "active" : ""}`}>
                <span className="material-symbols-outlined nav-ico">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
            <Link href={`/team/${user.id}`} className={`nav-link ${pathname === `/team/${user.id}` ? "active" : ""}`}>
              <span className="material-symbols-outlined nav-ico">view_kanban</span>
              <span>Мои задачи</span>
            </Link>
            <Link href="/bugs" className={`nav-link ${pathname.startsWith("/bugs") ? "active" : ""}`}>
              <span className="material-symbols-outlined nav-ico">bug_report</span>
              <span style={{ flex: 1 }}>Баги</span>
              {isAdmin && bugCount > 0 && (
                <span style={{ background: "var(--red)", color: "white", fontSize: 10, fontWeight: 700, borderRadius: 8, padding: "1px 5px", fontFamily: "JetBrains Mono, monospace" }}>
                  {bugCount > 9 ? "9+" : bugCount}
                </span>
              )}
            </Link>
          </div>

          {departments.filter((d) => !d.admin_only).length > 0 && (
            <div className="nav-group">
              <div className="nav-group-label">Отделы</div>
              {departments.filter((d) => !d.admin_only).map((d) => (
                <Link key={d.id} href={`/dept/${d.slug}`} className={`nav-link ${pathname === `/dept/${d.slug}` ? "active" : ""}`}>
                  <span className="material-symbols-outlined nav-ico">{d.icon}</span>
                  <span>{d.name}</span>
                </Link>
              ))}
            </div>
          )}

          {(isFounder || isAdmin) && (
            <div className="nav-group">
              <div className="nav-group-label">Администрирование</div>
              <Link href="/admin/staff" className={`nav-link ${pathname.startsWith("/admin/staff") ? "active" : ""}`}>
                <span className="material-symbols-outlined nav-ico">group</span>
                <span>Сотрудники</span>
              </Link>
              {departments.filter((d) => d.admin_only).map((d) => (
                <Link key={d.id} href={`/dept/${d.slug}`} className={`nav-link ${pathname === `/dept/${d.slug}` ? "active" : ""}`}>
                  <span className="material-symbols-outlined nav-ico">{d.icon}</span>
                  <span>{d.name}</span>
                </Link>
              ))}
            </div>
          )}
        </nav>

        <div className="sidebar-foot">
          <div className="foot-user-row">
            <div className="foot-user-info" onClick={() => router.push("/profile")}>
              <Avatar name={user.name} color={user.avatar_color} size={32} />
              <div style={{ minWidth: 0 }}>
                <div className="foot-name">{user.name}</div>
                <div className="foot-role">{isAdmin ? "Администратор" : user.position}</div>
              </div>
            </div>
            <button className="foot-logout" onClick={logout} title="Выйти">
              <span className="material-symbols-outlined" style={{ fontSize: 19 }}>logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 49 }} />
      )}

      {/* MAIN */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <header className="topbar">
          <button className="hamburger" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>menu</span>
          </button>
          <span className="topbar-title">{pageTitle}</span>
          <div className="topbar-right">
            {/* Search */}
            <div ref={searchRef} style={{ position: "relative" }}>
              <div className="search-box">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>search</span>
                <input placeholder="Поиск…" value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  onFocus={() => searchResults && setSearchOpen(true)} />
                {searchQ && <button onClick={() => { setSearchQ(""); setSearchOpen(false); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", padding: 0 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                </button>}
              </div>
              {searchOpen && searchResults && (
                <div className="search-dropdown">
                  {searchResults.users.length === 0 && searchResults.servers.length === 0 && searchResults.tasks.length === 0 ? (
                    <div className="search-empty">Ничего не найдено</div>
                  ) : (
                    <>
                      {searchResults.users.length > 0 && (
                        <div className="search-section">
                          <div className="search-section-label">Сотрудники</div>
                          {searchResults.users.map((u: any) => (
                            <div key={u.id} className="search-item" onClick={() => handleSearchSelect(u)}>
                              <Avatar name={u.name} color={u.avatar_color} size={24} />
                              <div><div className="si-title">{u.name}</div><div className="si-meta">{u.position}</div></div>
                            </div>
                          ))}
                        </div>
                      )}
                      {searchResults.servers.length > 0 && (
                        <div className="search-section">
                          <div className="search-section-label">Боты</div>
                          {searchResults.servers.map((s: any) => (
                            <div key={s.id} className="search-item" onClick={() => handleSearchSelect(s)}>
                              <span className="material-symbols-outlined si-ico">smart_toy</span>
                              <div><div className="si-title">{s.company}</div><div className="si-meta">{s.status === "new" ? "Новый бот" : "Тех поддержка"}</div></div>
                            </div>
                          ))}
                        </div>
                      )}
                      {searchResults.tasks.length > 0 && (
                        <div className="search-section">
                          <div className="search-section-label">Задачи</div>
                          {searchResults.tasks.map((t: any) => (
                            <div key={t.id} className="search-item" onClick={() => handleSearchSelect(t)}>
                              <span className="material-symbols-outlined si-ico">task_alt</span>
                              <div><div className="si-title">{t.title}</div></div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Theme toggle */}
            <button className="icon-btn" onClick={toggleTheme} title="Сменить тему">
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{theme === "light" ? "dark_mode" : "light_mode"}</span>
            </button>

            {/* Notifications */}
            <div ref={notifRef} style={{ position: "relative" }}>
              <button className="icon-btn" onClick={() => { setNotifOpen(!notifOpen); notifApi.get().then(setNotifs).catch(() => {}); }} title="Уведомления">
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>notifications</span>
                {totalNotifs > 0 && <span className="notif-badge">{totalNotifs > 9 ? "9+" : totalNotifs}</span>}
              </button>
              {notifOpen && (
                <div className="notif-dropdown">
                  <div className="notif-head">
                    Уведомления {totalNotifs > 0 && <span className="notif-count">{totalNotifs}</span>}
                  </div>
                  {notifs.items.length === 0 ? (
                    <div className="search-empty">Всё в порядке 👍</div>
                  ) : (
                    <div style={{ maxHeight: 360, overflowY: "auto" }}>
                      {notifs.items.map((n) => (
                        <div key={n.id} className={`notif-item notif-${n.kind}`}
                          onClick={() => { setNotifOpen(false); if (n.owner_id) router.push(`/team/${n.owner_id}`); }}>
                          <span className="material-symbols-outlined notif-ico">
                            {n.kind === "overdue" ? "warning" : "assignment"}
                          </span>
                          <div>
                            <div className="notif-title">{n.title}</div>
                            <div className="notif-meta">{n.meta}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="content fade-in">{children}</main>
      </div>

      <style jsx global>{`
        .sidebar { width: 240px; flex-shrink: 0; height: 100vh; background: var(--sidebar-bg); display: flex; flex-direction: column; transition: transform 0.25s ease; }
        .hamburger { display: none; background: none; border: none; color: var(--text2); cursor: pointer; padding: 4px; border-radius: 6px; margin-right: 4px; }
        .hamburger:hover { background: var(--bg3); }
        @media (max-width: 768px) {
          .sidebar { position: fixed; left: 0; top: 0; z-index: 50; transform: translateX(-100%); }
          .sidebar.sidebar-open { transform: translateX(0); }
          .hamburger { display: flex; align-items: center; justify-content: center; }
          .content { padding: 16px !important; }
          .topbar { padding: 0 16px !important; }
          .kcol { width: 260px !important; }
          .stat-row { grid-template-columns: 1fr !important; }
          .dash-grid { grid-template-columns: 1fr !important; }
          .backend-row { grid-template-columns: 1fr !important; }
          .prompters-grid { grid-template-columns: 1fr !important; }
          .search-box input { width: 100px !important; }
          .search-dropdown, .notif-dropdown { width: 280px !important; right: -60px; }
        }
        .sidebar-brand { display: flex; align-items: center; gap: 10px; padding: 20px 16px 16px; }
        .brand-logo { width: 36px; height: 36px; border-radius: 8px; background: linear-gradient(135deg, var(--primary), #6063ee); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 16px; flex-shrink: 0; }
        .brand-name { font-size: 15px; font-weight: 600; color: #fff; }
        .brand-sub { font-size: 11px; color: var(--sidebar-text2); margin-top: 1px; }
        .sidebar-nav { flex: 1; overflow-y: auto; padding: 12px 8px; }
        .nav-group { margin-bottom: 20px; }
        .nav-group-label { font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--sidebar-text2); padding: 0 10px; margin-bottom: 6px; }
        .nav-link { display: flex; align-items: center; gap: 11px; padding: 8px 10px; border-radius: 6px; margin-bottom: 2px; color: var(--sidebar-text); text-decoration: none; font-size: 14px; font-weight: 400; transition: all 0.13s; }
        .nav-link:hover { background: var(--sidebar-hover); color: #e8e8f0; }
        .nav-link.active { background: var(--primary); color: #fff; font-weight: 500; }
        .nav-ico { font-size: 20px; flex-shrink: 0; }
        .sidebar-foot { padding: 12px 12px 16px; border-top: 1px solid rgba(255,255,255,0.06); }
        .foot-user-row { display: flex; align-items: center; gap: 8px; }
        .foot-user-info { display: flex; align-items: center; gap: 10px; flex: 1; padding: 8px; border-radius: 8px; cursor: pointer; min-width: 0; transition: background 0.13s; }
        .foot-user-info:hover { background: var(--sidebar-hover); }
        .foot-name { font-size: 13px; font-weight: 500; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .foot-role { font-size: 11px; color: var(--sidebar-text2); }
        .foot-logout { width: 34px; height: 34px; border: none; background: transparent; color: var(--sidebar-text2); border-radius: 7px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.13s; }
        .foot-logout:hover { background: var(--sidebar-hover); color: var(--red); }
        .topbar { height: 60px; flex-shrink: 0; border-bottom: 1px solid var(--border); background: var(--bg2); display: flex; align-items: center; gap: 16px; padding: 0 28px; }
        .topbar-title { font-size: 16px; font-weight: 600; color: var(--text); }
        .topbar-right { margin-left: auto; display: flex; align-items: center; gap: 10px; }
        .search-box { display: flex; align-items: center; gap: 8px; background: var(--bg3); border: 1px solid var(--border); border-radius: 8px; padding: 7px 12px; color: var(--text3); transition: border-color 0.15s; }
        .search-box:focus-within { border-color: var(--primary); }
        .search-box input { background: none; border: none; outline: none; font-family: inherit; font-size: 13px; color: var(--text); width: 160px; }
        .search-box input::placeholder { color: var(--text3); }
        .search-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 320px; background: var(--bg2); border: 1px solid var(--border); border-radius: 10px; box-shadow: var(--shadow-md); z-index: 200; overflow: hidden; }
        .search-section { padding: 6px 0; border-bottom: 1px solid var(--border); }
        .search-section:last-child { border-bottom: none; }
        .search-section-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text3); padding: 4px 12px; }
        .search-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; cursor: pointer; transition: background 0.12s; }
        .search-item:hover { background: var(--bg-hover); }
        .si-ico { font-size: 22px; color: var(--text3); width: 24px; text-align: center; }
        .si-title { font-size: 13px; font-weight: 500; color: var(--text); }
        .si-meta { font-size: 11px; color: var(--text3); }
        .search-empty { padding: 16px; text-align: center; color: var(--text3); font-size: 13px; }
        .icon-btn { width: 36px; height: 36px; border-radius: 8px; border: none; background: transparent; color: var(--text2); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.13s, color 0.13s; position: relative; }
        .icon-btn:hover { background: var(--bg3); color: var(--text); }
        .notif-badge { position: absolute; top: 4px; right: 4px; background: var(--red); color: white; font-size: 9px; font-weight: 700; border-radius: 8px; padding: 1px 4px; font-family: "JetBrains Mono", monospace; line-height: 1.3; }
        .notif-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 340px; background: var(--bg2); border: 1px solid var(--border); border-radius: 10px; box-shadow: var(--shadow-md); z-index: 200; overflow: hidden; }
        .notif-head { padding: 12px 16px; font-size: 13px; font-weight: 600; color: var(--text); border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 8px; }
        .notif-count { background: var(--primary-dim); color: var(--primary); font-size: 11px; padding: 1px 7px; border-radius: 10px; font-weight: 600; }
        .notif-item { display: flex; align-items: flex-start; gap: 12px; padding: 12px 16px; cursor: pointer; border-bottom: 1px solid var(--border); transition: background 0.12s; }
        .notif-item:last-child { border-bottom: none; }
        .notif-item:hover { background: var(--bg-hover); }
        .notif-overdue .notif-ico { color: var(--red); }
        .notif-assigned .notif-ico { color: var(--primary); }
        .notif-ico { font-size: 22px; margin-top: 1px; flex-shrink: 0; }
        .notif-title { font-size: 13px; font-weight: 500; color: var(--text); line-height: 1.4; }
        .notif-meta { font-size: 11px; color: var(--text3); margin-top: 2px; }
        .content { flex: 1; overflow-y: auto; padding: 28px 32px; }
        .page-head { margin-bottom: 24px; }
        .page-h1 { font-size: 26px; font-weight: 600; letter-spacing: -0.01em; color: var(--text); }
        .page-desc { font-size: 14px; color: var(--text2); margin-top: 4px; }
        .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; font-family: inherit; transition: all 0.15s; }
        .btn-primary { background: var(--primary); color: white; }
        .btn-primary:hover { background: var(--primary-hover); }
        .btn-ghost { background: var(--bg2); border: 1px solid var(--border); color: var(--text2); }
        .btn-ghost:hover { border-color: var(--border2); color: var(--text); }
        .card { background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; transition: border-color 0.15s, box-shadow 0.15s, background 0.25s; }
      `}</style>
    </div>
  );
}
