"use client";

import { FirebaseError } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { ArrowRight, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { auth, googleProvider } from "@/firebase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

function getAuthErrorMessage(error: unknown) {
  if (error instanceof FirebaseError) {
    if (error.code === "auth/invalid-credential") {
      return "Identifiants incorrects. Verifiez votre email et mot de passe.";
    }

    if (error.code === "auth/email-already-in-use") {
      return "Cet email est deja utilise. Connectez-vous avec ce compte.";
    }

    if (error.code === "auth/weak-password") {
      return "Le mot de passe doit contenir au moins 6 caracteres.";
    }
  }

  return "Connexion impossible pour le moment. Reessayez.";
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24">
      <path
        d="M21.6 12.23c0-.74-.07-1.45-.19-2.14H12v4.05h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.23c1.89-1.74 2.98-4.31 2.98-7.44Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.96-.89 6.62-2.42l-3.23-2.51c-.9.6-2.04.95-3.39.95-2.6 0-4.81-1.76-5.6-4.12H3.07v2.59A9.99 9.99 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.4 13.9a6.01 6.01 0 0 1 0-3.8V7.51H3.07a10.01 10.01 0 0 0 0 8.98L6.4 13.9Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.98c1.47 0 2.8.51 3.84 1.5l2.86-2.86C16.96 3 14.7 2 12 2a9.99 9.99 0 0 0-8.93 5.51L6.4 10.1C7.19 7.74 9.4 5.98 12 5.98Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace("/");
        return;
      }

      setIsCheckingSession(false);
    });
  }, [router]);

  async function handleEmailAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);

    try {
      if (isCreatingAccount) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      setMessage("Connexion reussie. Redirection vers le dashboard...");
      router.replace("/");
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleAuth() {
    setError("");
    setMessage("");
    setIsLoading(true);

    try {
      await signInWithPopup(auth, googleProvider);
      setMessage("Connexion Google reussie. Redirection vers le dashboard...");
      router.replace("/");
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-[#141044] text-white lg:grid-cols-[minmax(0,1fr)_minmax(28rem,36rem)]">
      <section className="relative hidden overflow-hidden p-10 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(111,182,255,0.24),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(255,47,69,0.32),_transparent_34%)]" />
        <div className="relative z-10">
          <Badge className="bg-[#6fb6ff]/20 text-[#9fd0ff]">
            PROCO & Cie IT
          </Badge>
          <h1 className="mt-8 max-w-2xl text-5xl font-black leading-tight">
            Acces securise a la plateforme de stock et suivi materiel.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
            Connectez-vous pour gerer les actifs IT, suivre les pannes, tracer
            les mouvements et piloter les inventaires.
          </p>
        </div>

        <div className="relative z-10 grid max-w-3xl gap-4 md:grid-cols-3">
          {["Stock", "Pannes", "Audit"].map((item) => (
            <Card className="border-white/10 bg-white/7 text-white ring-0" key={item}>
              <CardContent className="p-5">
                <ShieldCheck className="mb-4 size-6 text-[#6fb6ff]" />
                <p className="font-bold">{item}</p>
                <p className="mt-2 text-sm text-slate-400">Acces controle</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center bg-[#0f0b34]/55 px-6 py-10">
        <Card className="w-full max-w-lg border-white/10 bg-[#11183b]/95 text-white shadow-2xl shadow-black/40 ring-0">
          <CardHeader>
            <CardTitle className="text-3xl font-black">
              {isCreatingAccount ? "Creer un compte" : "Connexion"}
            </CardTitle>
            <CardDescription className="text-slate-400">
              Utilisez votre email PROCO & Cie ou votre compte Google.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isCheckingSession ? (
              <div className="rounded-2xl border border-white/10 bg-white/6 p-4 text-sm text-slate-300">
                Verification de la session...
              </div>
            ) : (
              <>
                <form className="space-y-4" onSubmit={handleEmailAuth}>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-300">Email</span>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    autoComplete="email"
                    className="h-11 border-white/10 bg-white/6 pl-10 text-white"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="it@procordc.com"
                    required
                    type="email"
                    value={email}
                  />
                </div>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-300">
                  Mot de passe
                </span>
                <div className="relative">
                  <LockKeyhole className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    autoComplete={
                      isCreatingAccount ? "new-password" : "current-password"
                    }
                    className="h-11 border-white/10 bg-white/6 pl-10 text-white"
                    minLength={6}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Minimum 6 caracteres"
                    required
                    type="password"
                    value={password}
                  />
                </div>
              </label>

              {error ? (
                <p className="rounded-lg bg-[#ff2f45]/15 px-3 py-2 text-sm text-[#ff91a0]">
                  {error}
                </p>
              ) : null}
              {message ? (
                <p className="rounded-lg bg-[#6fb6ff]/15 px-3 py-2 text-sm text-[#9fd0ff]">
                  {message}
                </p>
              ) : null}

              <Button
                className="h-11 w-full bg-[#ff2f45] text-white hover:bg-[#ff4b5e]"
                disabled={isLoading}
                type="submit"
              >
                {isLoading
                  ? "Traitement..."
                  : isCreatingAccount
                    ? "Creer le compte"
                    : "Se connecter"}
                <ArrowRight className="size-4" />
              </Button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <Separator className="flex-1 bg-white/10" />
              <span className="text-xs uppercase tracking-[0.25em] text-slate-500">
                ou
              </span>
              <Separator className="flex-1 bg-white/10" />
            </div>

            <Button
              className="h-11 w-full border border-white/15 !bg-white font-bold !text-[#141044] shadow-lg shadow-black/10 hover:!bg-slate-100 hover:!text-[#141044]"
              disabled={isLoading}
              onClick={handleGoogleAuth}
              type="button"
            >
              <GoogleIcon />
              Continuer avec Google
            </Button>

            <div className="mt-6 flex items-center justify-between text-sm">
              <button
                className="font-semibold text-[#9fd0ff]"
                onClick={() => setIsCreatingAccount((value) => !value)}
                type="button"
              >
                {isCreatingAccount
                  ? "J'ai deja un compte"
                  : "Creer un nouveau compte"}
              </button>
              <Link className="text-slate-400 hover:text-white" href="/sign-out">
                Deconnexion
              </Link>
            </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
