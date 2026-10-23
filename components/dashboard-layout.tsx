"use client";

import { History, LayoutDashboard, Package, Settings, UserCheck, Wrench } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

import { DashboardUserMenu } from "@/components/dashboard-user-menu";
import { Badge } from "@/components/ui/badge";
import { KYC_NAV } from "@/lib/kyc-excel/terminology";
import { apiFetch } from "@/lib/api-client";

const navItems = [
  { label: KYC_NAV.DASHBOARD, icon: LayoutDashboard, href: "/", badge: null as string | null },
  { label: KYC_NAV.STOCK, icon: Package, href: "/inventory", badge: "stock" },
  { label: KYC_NAV.ASSIGNMENTS, icon: UserCheck, href: "/affectations", badge: "assignments" },
  { label: KYC_NAV.INCIDENTS, icon: Wrench, href: "/pannes", badge: "incidents" },
  { label: KYC_NAV.HISTORY, icon: History, href: "/historique", badge: null },
  { label: KYC_NAV.SETTINGS, icon: Settings, href: "/parametres", badge: null },
];

export function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [openIncidents, setOpenIncidents] = useState(0);
  const [assignmentAlerts, setAssignmentAlerts] = useState(0);
  const [stockAlerts, setStockAlerts] = useState(0);

  useEffect(() => {
    async function loadNotifications() {
      const response = await apiFetch("/api/notifications", { cache: "no-store" });
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
    <main className="flex h-screen bg-slate-950 text-slate-100">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-white/10 bg-slate-900 p-3 xl:flex xl:flex-col">
        <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-3">
          <div className="relative h-8 w-12">
            <Image
              alt="Logo PROCO"
              className="object-contain"
              fill
              priority
              sizes="48px"
              src="/assets/proco-logo.png"
            />
          </div>
          <div>
            <p className="text-[10px] uppercase text-slate-500">PROCO</p>
            <p className="text-sm font-semibold">IT Inventory</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                className={`flex h-9 items-center gap-2 rounded px-2 text-sm ${
                  isActive
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                }`}
                href={item.href}
                key={item.label}
              >
                <Icon className="size-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.badge === "stock" && stockAlerts > 0 ? (
                  <Badge className="bg-red-600 px-1.5 text-white">{stockAlerts}</Badge>
                ) : null}
                {item.badge === "assignments" && assignmentAlerts > 0 ? (
                  <Badge className="bg-amber-500 px-1.5 text-slate-900">
                    {assignmentAlerts}
                  </Badge>
                ) : null}
                {item.badge === "incidents" && openIncidents > 0 ? (
                  <Badge className="bg-red-600 px-1.5 text-white">{openIncidents}</Badge>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto hidden border-t border-white/10 pt-3 xl:block">
          <DashboardUserMenu />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-2 xl:hidden">
          <p className="text-sm font-semibold">IT Inventory</p>
          <DashboardUserMenu />
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
      </div>
    </main>
  );
}
