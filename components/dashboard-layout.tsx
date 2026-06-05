"use client";

import {
  FileText,
  History,
  LayoutDashboard,
  Package,
  UserCheck,
  Settings,
  UsersRound,
  Wrench,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

import { DashboardUserMenu } from "@/components/dashboard-user-menu";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { label: "Tableau de bord", icon: LayoutDashboard, href: "/" },
  { label: "Gestion stock", icon: Package, href: "/inventory" },
  { label: "Affectations", icon: UserCheck, href: "/affectations" },
  { label: "Techniciens", icon: UsersRound, href: "/techniciens" },
  { label: "Pannes", icon: Wrench, href: "/pannes" },
  { label: "Historique", icon: History, href: "/historique" },
  { label: "Rapports", icon: FileText, href: "/rapports" },
  { label: "Parametres", icon: Settings, href: "/parametres" },
];

export function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [openIncidents, setOpenIncidents] = useState(0);
  const [assignmentAlerts, setAssignmentAlerts] = useState(0);
  const [stockAlerts, setStockAlerts] = useState(0);

  useEffect(() => {
    async function loadNotifications() {
      const response = await fetch("/api/notifications", { cache: "no-store" });

      if (response.ok) {
        const data = await response.json();
        setOpenIncidents(data.openIncidents ?? 0);
        setAssignmentAlerts(data.assignmentReturnAlerts?.count ?? 0);
        setStockAlerts(data.stockAlerts?.count ?? 0);
      }
    }

    void loadNotifications();
    const interval = window.setInterval(loadNotifications, 30000);

    window.addEventListener("focus", loadNotifications);
    window.addEventListener("stock-it:notifications-changed", loadNotifications);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", loadNotifications);
      window.removeEventListener("stock-it:notifications-changed", loadNotifications);
    };
  }, [pathname]);

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#141044] p-4 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,47,69,0.35),_transparent_34%),radial-gradient(circle_at_10%_0%,_rgba(111,182,255,0.24),_transparent_30%)]" />

      <section className="relative z-10 flex h-full w-full flex-col gap-4">
        <header className="flex shrink-0 items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-18 overflow-hidden bg-[#141044] shadow-lg shadow-black/20">
              <Image
                alt="Logo PROCO & Cie"
                className="object-contain"
                fill
                priority
                sizes="144px"
                src="/assets/proco-logo.png"
              />
            </div>
            <div>
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.38em] text-[#6fb6ff]">
                PROCO & Cie
              </p>
              <h1 className="text-2xl font-black tracking-[0.24em] text-white">
                IT INVENTORY
              </h1>
            </div>
          </div>

          <DashboardUserMenu />
        </header>

        <div className="grid min-h-0 flex-1 grid-rows-1 overflow-hidden rounded-[2rem] border border-white/10 bg-[#1a1d4d]/95 shadow-2xl shadow-black/40 backdrop-blur xl:grid-cols-[17rem_1fr]">
          <aside className="hidden min-h-0 flex-col border-r border-white/10 bg-[#151b44] p-5 xl:flex">

            <nav className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Link
                    className={`flex h-11 w-full items-center justify-start gap-3 rounded-lg px-2.5 text-sm font-medium transition-all ${
                      isActive
                        ? "bg-[#6fb6ff]/18 text-white hover:bg-[#6fb6ff]/24"
                        : "bg-transparent text-slate-300 hover:bg-white/8 hover:text-white"
                    }`}
                    href={item.href}
                    key={item.label}
                  >
                    <Icon className="size-4" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.label === "Gestion stock" && stockAlerts > 0 ? (
                      <Badge className="min-w-5 justify-center bg-[#ff2f45] px-1.5 text-white">
                        {stockAlerts}
                      </Badge>
                    ) : null}
                    {item.label === "Affectations" && assignmentAlerts > 0 ? (
                      <Badge className="min-w-5 justify-center bg-amber-500 px-1.5 text-[#0d1433]">
                        {assignmentAlerts}
                      </Badge>
                    ) : null}
                    {item.label === "Pannes" && openIncidents > 0 ? (
                      <Badge className="min-w-5 justify-center bg-[#ff2f45] px-1.5 text-white">
                        {openIncidents}
                      </Badge>
                    ) : null}
                  </Link>
                );
              })}
            </nav>
          </aside>

          <div className="min-h-0 h-full overflow-y-auto overflow-x-hidden overscroll-y-contain p-4 [scrollbar-gutter:stable]">
            {children}
          </div>
        </div>
      </section>
    </main>
  );
}
