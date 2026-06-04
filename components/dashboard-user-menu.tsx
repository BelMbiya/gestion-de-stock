"use client";

import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { auth } from "@/firebase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

function getInitials(user: User | null) {
  const source = user?.displayName ?? user?.email ?? "IT";

  return source
    .split(/[ .@_-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function DashboardUserMenu() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  async function handleSignOut() {
    await signOut(auth);
    router.replace("/sign-in");
  }

  return (
    <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/6 px-2 py-1.5">
      <Avatar className="size-9 bg-[#6fb6ff] text-[#141044]">
        {user?.photoURL ? (
          <AvatarImage alt={user.displayName ?? "Profil utilisateur"} src={user.photoURL} />
        ) : null}
        <AvatarFallback className="bg-[#6fb6ff] text-xs font-black text-[#141044]">
          {getInitials(user)}
        </AvatarFallback>
      </Avatar>

      <div className="hidden min-w-0 leading-tight md:block">
        <p className="max-w-36 truncate text-sm font-bold text-white">
          {user?.displayName ?? "Utilisateur IT"}
        </p>
        <p className="max-w-36 truncate text-xs text-slate-400">
          {user?.email ?? "Session Google"}
        </p>
      </div>

      <Button
        className="h-8 rounded-full bg-[#ff2f45] px-3 text-white hover:bg-[#ff4b5e]"
        onClick={handleSignOut}
        title="Se deconnecter"
      >
        <LogOut className="size-4" />
        <span className="hidden lg:inline">Deconnexion</span>
      </Button>
    </div>
  );
}
