
"use client";

import type { User } from "@/lib/types";
import React, { createContext, useState, useEffect, ReactNode } from "react";
import { MOCK_USERS } from "@/lib/constants"; // Using mock users for now
import { useRouter, usePathname } from "next/navigation";

interface AuthContextType {
  user: User | null;
  login: (email: string, pass: string) => Promise<boolean>;
  loginWithMicrosoft: () => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>; // Added for Google
  logout: () => void;
  loading: boolean;
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MICROSOFT_MOCK_USER_ID = "user_ms"; // Unique ID for Microsoft mock user
const GOOGLE_MOCK_USER_ID = "user_gg"; // Unique ID for Google mock user

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Simulate checking for persisted auth state
    const storedUser = localStorage.getItem("timewise_user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loading && !user && !pathname.startsWith("/login")) {
      router.push("/login");
    } else if (!loading && user && pathname.startsWith("/login")) {
      router.push("/send-event");
    }
  }, [user, loading, router, pathname]);

  const login = async (email: string, pass: string): Promise<boolean> => {
    setLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    const foundUser = MOCK_USERS.find(u => u.email === email && u.password === pass);
    if (foundUser) {
      const userData = { id: foundUser.id, name: foundUser.name, email: foundUser.email, avatar: foundUser.avatar };
      setUser(userData);
      localStorage.setItem("timewise_user", JSON.stringify(userData));
      setLoading(false);
      router.push("/send-event");
      return true;
    }
    setUser(null);
    setLoading(false);
    return false;
  };

  const loginWithMicrosoft = async (): Promise<boolean> => {
    setLoading(true);
    // Simulate Microsoft OAuth flow
    await new Promise(resolve => setTimeout(resolve, 1500));

    let microsoftUser = MOCK_USERS.find(u => u.id === MICROSOFT_MOCK_USER_ID);
    if (!microsoftUser) {
        microsoftUser = {
            id: MICROSOFT_MOCK_USER_ID,
            name: "Bill Gates (MS)",
            email: "bill.gates@example.com", 
            avatar: "https://picsum.photos/seed/microsoft/100/100",
        };
    }
    
    const userData = { id: microsoftUser.id, name: microsoftUser.name, email: microsoftUser.email, avatar: microsoftUser.avatar };
    setUser(userData);
    localStorage.setItem("timewise_user", JSON.stringify(userData));
    setLoading(false);
    router.push("/send-event");
    return true;
  };

  const loginWithGoogle = async (): Promise<boolean> => {
    setLoading(true);
    // Simulate Google OAuth flow
    await new Promise(resolve => setTimeout(resolve, 1500));

    let googleUser = MOCK_USERS.find(u => u.id === GOOGLE_MOCK_USER_ID);
    if (!googleUser) {
        googleUser = {
            id: GOOGLE_MOCK_USER_ID,
            name: "Larry Page (GG)",
            email: "larry.page@example.com",
            avatar: "https://picsum.photos/seed/google/100/100",
        };
    }
    
    const userData = { id: googleUser.id, name: googleUser.name, email: googleUser.email, avatar: googleUser.avatar };
    setUser(userData);
    localStorage.setItem("timewise_user", JSON.stringify(userData));
    setLoading(false);
    router.push("/send-event");
    return true;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("timewise_user");
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, login, loginWithMicrosoft, loginWithGoogle, logout, loading, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};
