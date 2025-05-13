
"use client"; 

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center space-y-6 p-4 text-center">
      <AlertTriangle className="h-16 w-16 text-destructive" />
      <h2 className="text-3xl font-semibold text-destructive">Oops, something went wrong!</h2>
      <p className="text-lg text-muted-foreground max-w-md">
        We encountered an error while trying to load this page. Please try again.
      </p>
      {error.message && <p className="text-sm text-card-foreground bg-muted p-2 rounded-md">Error: {error.message}</p>}
      <Button
        onClick={() => reset()}
        variant="default"
        size="lg"
      >
        Try Again
      </Button>
    </div>
  );
}
