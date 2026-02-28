import { useState } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  HiOutlineViewGrid,
  HiOutlineDocumentText,
  HiOutlineUpload,
  HiOutlineLogout,
  HiOutlineMenu,
  HiOutlineX,
  HiOutlineSparkles,
} from "react-icons/hi";

const navItems = [
  { label: "Workspaces", path: "/dashboard", icon: HiOutlineViewGrid },
  { label: "Papers", path: "/papers", icon: HiOutlineDocumentText },
  { label: "Documents", path: "/documents", icon: HiOutlineUpload },
  { label: "Build Paper", path: "/build-paper", icon: HiOutlineSparkles },
];

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const sidebar = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-sidebar-border">
        <Link to="/dashboard" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">R</span>
          </div>
          <span className="text-base font-bold text-foreground tracking-tight">
            Research<span className="text-gradient-brand">Hub</span>
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-primary-foreground text-xs font-semibold uppercase">
              {user?.username?.[0] ?? "U"}
            </span>
          </div>
          <span className="text-sm text-foreground font-medium truncate flex-1">
            {user?.username}
          </span>
          <button
            onClick={logout}
            className="p-1.5 rounded-md btn-danger-ghost"
            title="Sign out"
          >
            <HiOutlineLogout className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 flex-col bg-sidebar border-r border-sidebar-border flex-shrink-0 sticky top-0 h-screen">
        {sidebar}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 bg-sidebar border-r border-sidebar-border transform transition-transform duration-300 lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="absolute top-4 right-3">
          <button onClick={() => setMobileOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
            <HiOutlineX className="w-5 h-5" />
          </button>
        </div>
        {sidebar}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 flex items-center px-4 border-b border-border sticky top-0 z-30 surface-glass lg:hidden">
          <button onClick={() => setMobileOpen(true)} className="p-1.5 text-muted-foreground hover:text-foreground">
            <HiOutlineMenu className="w-5 h-5" />
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
