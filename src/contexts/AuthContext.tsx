
"use client";

import type { User } from "@/lib/types";
import React, { createContext, useState, useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  type User as FirebaseUser 
} from "firebase/auth";
import { auth as firebaseAuthService } from "@/lib/firebase"; // Import initialized auth service
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  user: User | null;
  login: (email: string, pass: string) => Promise<boolean>;
  loginWithMicrosoft: () => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  logout: () => void;
  loading: boolean;
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const mapFirebaseUserToAppUser = (firebaseUser: FirebaseUser | null): User | null => {
  if (!firebaseUser) return null;
  return {
    id: firebaseUser.uid,
    name: firebaseUser.displayName || "User",
    email: firebaseUser.email || "No email", // Ensure email is always a string
    avatar: firebaseUser.photoURL || `https://placehold.co/100x100.png?text=${(firebaseUser.displayName || firebaseUser.email || "U").charAt(0)}`,
  };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuthService, (firebaseUser) => {
      const appUser = mapFirebaseUserToAppUser(firebaseUser);
      setUser(appUser);
      setLoading(false);
    });

    return () => unsubscribe(); // Cleanup subscription on unmount
  }, []);

  useEffect(() => {
    // This effect handles redirection based on auth state
    // It should run after the initial loading is complete
    if (!loading) {
      if (!user && !pathname.startsWith("/login")) {
        router.replace("/login");
      } else if (user && pathname.startsWith("/login")) {
        router.replace("/send-event");
      }
    }
  }, [user, loading, router, pathname]);

  const handleAuthSuccess = (firebaseUser: FirebaseUser) => {
    const appUser = mapFirebaseUserToAppUser(firebaseUser);
    setUser(appUser);
    setLoading(false);
    router.push("/send-event");
    toast({ title: "Login Successful", description: `Welcome, ${appUser?.name}!`});
    return true;
  };

  const handleAuthError = (error: any, provider?: string) => {
    console.error(`${provider || 'Email'} login error:`, error);
    let description = "An unexpected error occurred. Please try again.";
    if (error.code) {
        switch (error.code) {
            case 'auth/user-not-found':
            case 'auth/wrong-password':
            case 'auth/invalid-credential':
                description = "Invalid email or password.";
                break;
            case 'auth/popup-closed-by-user':
                description = "Login process was cancelled.";
                break;
            case 'auth/account-exists-with-different-credential':
                description = "An account already exists with the same email address but different sign-in credentials. Sign in using a provider associated with this email address.";
                break;
            default:
                description = error.message || description;
        }
    }
    toast({ title: `${provider || 'Email'} Login Failed`, description, variant: "destructive" });
    setLoading(false);
    return false;
  };

  const login = async (email: string, pass: string): Promise<boolean> => {
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(firebaseAuthService, email, pass);
      return handleAuthSuccess(userCredential.user);
    } catch (error: any) {
      return handleAuthError(error, "Email");
    }
  };

  const loginWithProvider = async (provider: GoogleAuthProvider | OAuthProvider, providerName: string): Promise<boolean> => {
    setLoading(true);
    try {
      const result = await signInWithPopup(firebaseAuthService, provider);
      return handleAuthSuccess(result.user);
    } catch (error: any) {
      return handleAuthError(error, providerName);
    }
  };

  const loginWithGoogle = async (): Promise<boolean> => {
    const provider = new GoogleAuthProvider();
    return loginWithProvider(provider, "Google");
  };

  const loginWithMicrosoft = async (): Promise<boolean> => {
    const provider = new OAuthProvider('microsoft.com');
    // Optional: Add custom parameters or scopes
    // provider.setCustomParameters({ /* prompt: 'consent', */ /* tenant: 'YOUR_TENANT_ID' */ });
    // provider.addScope('user.read'); 
    return loginWithProvider(provider, "Microsoft");
  };

  const logout = async () => {
    setLoading(true);
    try {
      await firebaseSignOut(firebaseAuthService);
      setUser(null);
      router.push("/login");
      toast({ title: "Logged Out", description: "You have been successfully logged out."});
    } catch (error: any) {
      console.error("Logout error:", error);
      toast({ title: "Logout Failed", description: error.message || "Could not log out.", variant: "destructive"});
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, loginWithGoogle, loginWithMicrosoft, logout, loading, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};
