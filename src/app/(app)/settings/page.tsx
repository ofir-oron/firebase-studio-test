
import { SettingsForm } from "@/components/forms/SettingsForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMailingLists } from "@/lib/actions"; // Server action to fetch lists
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { Metadata } from "next";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Settings - ${APP_NAME}`,
};

async function MailingListWrapper() {
  const mailingLists = await getMailingLists();
  return <SettingsForm initialMailingLists={mailingLists} />;
}


export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your application settings and preferences.</p>
      </header>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Mailing List Configuration</CardTitle>
          <CardDescription>Define email addresses or distribution lists for event notifications.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <span className="ml-2">Loading settings...</span></div>}>
            <MailingListWrapper />
          </Suspense>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Manage your account settings.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Account management features like password change or profile updates would go here.
            For now, you can log out from the user menu in the sidebar.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
