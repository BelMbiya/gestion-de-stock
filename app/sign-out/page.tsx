"use client";

import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { auth } from "@/firebase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SignOutPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });
  }, []);

  async function handleSignOut() {
    setIsLoading(true);
    await signOut(auth);
    setMessage("Vous etes deconnecte.");
    setIsLoading(false);
    router.replace("/sign-in");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#141044] p-6 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,47,69,0.32),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(111,182,255,0.22),_transparent_30%)]" />

      <Card className="relative z-10 w-full max-w-md border-white/10 bg-[#11183b]/95 text-white shadow-2xl shadow-black/40 ring-0">
        <CardHeader>
          <Badge className="mb-3 w-fit bg-[#6fb6ff]/20 text-[#9fd0ff]">
            Session Firebase
          </Badge>
          <CardTitle className="flex items-center gap-3 text-3xl font-black">
            <LogOut className="size-7 text-[#ff2f45]" />
            Deconnexion
          </CardTitle>
          <CardDescription className="text-slate-400">
            Fermez votre session avant de quitter le poste ou le navigateur.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
            <div className="mb-3 flex items-center gap-2 text-[#9fd0ff]">
              <ShieldCheck className="size-4" />
              <span className="text-sm font-bold">Etat de la session</span>
            </div>
            {isLoading ? (
              <p className="text-sm text-slate-300">Verification...</p>
            ) : user ? (
              <div className="space-y-1 text-sm text-slate-300">
                <p>Connecte en tant que:</p>
                <p className="font-semibold text-white">
                  {user.email ?? user.displayName ?? "Utilisateur Firebase"}
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-300">
                Aucune session active pour le moment.
              </p>
            )}
          </div>

          {message ? (
            <p className="rounded-lg bg-[#6fb6ff]/15 px-3 py-2 text-sm text-[#9fd0ff]">
              {message}
            </p>
          ) : null}

          <Button
            className="h-11 w-full bg-[#ff2f45] text-white hover:bg-[#ff4b5e]"
            disabled={isLoading || !user}
            onClick={handleSignOut}
          >
            Se deconnecter
          </Button>

          <div className="flex items-center justify-between text-sm">
            <Link className="text-[#9fd0ff] hover:text-white" href="/sign-in">
              Retour connexion
            </Link>
            <Link className="text-slate-400 hover:text-white" href="/">
              Dashboard
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
