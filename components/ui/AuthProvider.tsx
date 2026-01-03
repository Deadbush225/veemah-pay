"use client";
import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Me = { 
  authenticated: boolean; 
  account?: { 
    account_number: string; 
    name: string; 
    balance: number; 
    status: string 
  } 
};

type AuthContextType = {
  me: Me | null;
  setMe: (me: Me) => void;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children, initialMe }: { 
  children: React.ReactNode; 
  initialMe: Me | null;
}) {
  const [me, setMe] = useState<Me | null>(initialMe || { authenticated: false });
  const router = useRouter();

  // Sync with server-provided initialMe after hydration
  useEffect(() => {
    if (initialMe && initialMe.authenticated !== me?.authenticated) {
      setMe(initialMe);
    }
  }, [initialMe, me?.authenticated]);

  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    setMe({ authenticated: false });
    router.replace("/");
  };

  // Refresh user data when needed
  const refreshMe = async () => {
    try {
      const response = await fetch("/api/me");
      const data = await response.json();
      setMe(data);
    } catch (error) {
      setMe({ authenticated: false });
    }
  };

  return (
    <AuthContext.Provider value={{ me, setMe, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}