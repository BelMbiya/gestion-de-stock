"use client";

import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

import { auth } from "@/firebase";

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/sign-in");
        return;
      }

      setIsCheckingSession(false);
    });
  }, [router]);

  if (isCheckingSession) {
    return null;
  }

  return children;
}
