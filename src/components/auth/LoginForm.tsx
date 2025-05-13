
"use client";

import { useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LogIn } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormInputs = z.infer<typeof loginSchema>;

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isMicrosoftLoading, setIsMicrosoftLoading] = useState(false);

  const auth = useAuth();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormInputs>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit: SubmitHandler<LoginFormInputs> = async (data) => {
    setIsLoading(true);
    const success = await auth.login(data.email, data.password);
    if (!success) {
      toast({
        title: "Login Failed",
        description: "Invalid email or password. Please try again.",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  const handleOAuthLogin = (provider: "google" | "microsoft") => {
    if (provider === "google") setIsGoogleLoading(true);
    if (provider === "microsoft") setIsMicrosoftLoading(true);

    // Simulate OAuth call
    setTimeout(() => {
      toast({
        title: "OAuth Login",
        description: `${provider === "google" ? "Google" : "Microsoft"} login is not implemented in this demo.`,
        variant: "default",
      });
      if (provider === "google") setIsGoogleLoading(false);
      if (provider === "microsoft") setIsMicrosoftLoading(false);
    }, 1500);
  };


  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="employee@example.com"
          {...register("email")}
          disabled={isLoading || isGoogleLoading || isMicrosoftLoading}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          {...register("password")}
          disabled={isLoading || isGoogleLoading || isMicrosoftLoading}
        />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={isLoading || isGoogleLoading || isMicrosoftLoading}>
        {isLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <LogIn className="mr-2 h-4 w-4" />
        )}
        Sign In with Email
      </Button>

      <div className="relative my-4">
        <Separator />
        <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center bg-card px-2">
          <span className="text-sm text-muted-foreground">Or continue with</span>
        </div>
      </div>
      
      <Button
        variant="outline"
        className="w-full"
        onClick={() => handleOAuthLogin("google")}
        disabled={isLoading || isGoogleLoading || isMicrosoftLoading}
        type="button"
      >
        {isGoogleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 
          <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path></svg>
        }
        Sign In with Google
      </Button>
      <Button
        variant="outline"
        className="w-full"
        onClick={() => handleOAuthLogin("microsoft")}
        disabled={isLoading || isGoogleLoading || isMicrosoftLoading}
        type="button"
      >
        {isMicrosoftLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 
         <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="microsoft" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M0 32h192v192H0V32zm0 256h192v192H0V288zm256-256h192v192H256V32zm256 256h192v192H256V288z"></path></svg>
        }
        Sign In with Microsoft
      </Button>
    </form>
  );
}
