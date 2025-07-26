"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/database/firebase";
import { SessionManager } from "./sessionManager";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const sessionManager = SessionManager.getInstance();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        sessionManager.stopSessionMonitoring();
        router.push("/view/signup");
        setAuthenticated(false);
      } else {
        setAuthenticated(true);
        sessionManager.startSessionMonitoring();
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      sessionManager.stopSessionMonitoring();
    };
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  if (!authenticated) {
    return null;
  }

  return <>{children}</>;
}
