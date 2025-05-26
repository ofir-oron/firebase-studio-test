
"use client";

import React, { useState, useEffect } from "react";
import { useForm, useFieldArray, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; // Added import
import { useToast } from "@/hooks/use-toast";
import { saveMailingLists, getMailingLists as fetchMailingListsAction } from "@/lib/actions";
import type { MailingList } from "@/lib/types";
import { Loader2, PlusCircle, Save, Trash2, RotateCcw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface SettingsFormProps {
  initialMailingLists: MailingList[];
}

const mailingListSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "List name cannot be empty."),
  emails: z.string().refine(val => val.split(',').every(email => z.string().email().safeParse(email.trim()).success), 
    "Provide a comma-separated list of valid email addresses."
  ),
});

const settingsFormSchema = z.object({
  mailingLists: z.array(mailingListSchema),
  newListName: z.string().optional(),
  newListEmails: z.string().optional().refine(val => {
    if (!val || val.trim() === "") return true; // Allow empty if newListName is also empty or not being added
    return val.split(',').every(email => z.string().email().safeParse(email.trim()).success);
  }, "Provide a comma-separated list of valid email addresses for the new list."),
}).refine(data => {
    // If newListName is provided, newListEmails must also be provided and valid.
    if (data.newListName && data.newListName.trim() !== "") {
        return data.newListEmails && data.newListEmails.trim() !== "" && data.newListEmails.split(',').every(email => z.string().email().safeParse(email.trim()).success);
    }
    return true;
}, { message: "If adding a new list, emails are required.", path: ["newListEmails"] });


type SettingsFormValues = z.infer<typeof settingsFormSchema>;

export function SettingsForm({ initialMailingLists }: SettingsFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingLists, setIsFetchingLists] = useState(false);

  const { control, register, handleSubmit, reset, getValues, formState: { errors } } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      mailingLists: initialMailingLists.map(ml => ({ ...ml, emails: ml.emails.join(", ") })),
      newListName: "",
      newListEmails: ""
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "mailingLists",
  });
  
  useEffect(() => {
    reset({ 
        mailingLists: initialMailingLists.map(ml => ({ ...ml, emails: ml.emails.join(", ") })),
        newListName: "",
        newListEmails: ""
    });
  }, [initialMailingLists, reset]);


  const fetchMailingLists = async () => {
    setIsFetchingLists(true);
    const lists = await fetchMailingListsAction();
    reset({ mailingLists: lists.map(ml => ({...ml, emails: ml.emails.join(", ")})), newListName: "", newListEmails: "" });
    setIsFetchingLists(false);
  };

  const onSubmit: SubmitHandler<SettingsFormValues> = async (data) => {
    setIsLoading(true);

    const formData = new FormData();
    if (data.newListName && data.newListEmails) {
        formData.append("newListName", data.newListName);
        formData.append("newListEmails", data.newListEmails);
    }
    // For existing lists, a real app might send structured updates
    // For this mock, the server action mainly focuses on new list addition via FormData easily
    // and logs intent for updates.
    // formData.append("updatedLists", JSON.stringify(data.mailingLists));


    const result = await saveMailingLists(formData);

    if (result.success) {
      toast({
        title: "Settings Saved",
        description: result.message || "Your mailing list configurations have been updated.",
      });
      fetchMailingLists(); // Refresh lists from "DB"
      reset({ ...getValues(), newListName: "", newListEmails: "" }); // Clear new list fields
    } else {
      toast({
        title: "Error Saving Settings",
        description: result.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };
  
  const handleAddNewList = () => {
    const newName = getValues("newListName");
    const newEmails = getValues("newListEmails");

    if (newName && newEmails && newName.trim() !== "" && newEmails.trim() !== "" && newEmails.split(',').every(email => z.string().email().safeParse(email.trim()).success)) {
         // This new list will be handled by the server action on submit
         // For UI, we can clear fields, actual addition to `fields` would be after successful save & re-fetch
         // For now, let's just let the main form submission handle new list addition
        toast({ title: "New List Staged", description: "The new list will be added upon saving all settings."});
    } else {
        toast({ title: "Invalid New List", description: "Please provide a valid name and comma-separated emails for the new list.", variant: "destructive"});
    }
  };


  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <div className="flex justify-end">
        <Button onClick={fetchMailingLists} variant="outline" size="sm" disabled={isFetchingLists || isLoading}>
          <RotateCcw className={`mr-2 h-4 w-4 ${isFetchingLists ? 'animate-spin' : ''}`} />
          Refresh Lists
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Existing Mailing Lists</CardTitle>
          <CardDescription>Manage your current recipient lists.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="space-y-2 p-3 border rounded-md bg-background">
              <div>
                <Label htmlFor={`mailingLists.${index}.name`}>List Name</Label>
                <Input
                  id={`mailingLists.${index}.name`}
                  {...register(`mailingLists.${index}.name`)}
                  className="mt-1"
                  disabled // Make existing lists read-only for this simplified example
                />
                {errors.mailingLists?.[index]?.name && (
                  <p className="text-sm text-destructive">{errors.mailingLists[index]?.name?.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor={`mailingLists.${index}.emails`}>Emails (comma-separated)</Label>
                <Textarea
                  id={`mailingLists.${index}.emails`}
                  {...register(`mailingLists.${index}.emails`)}
                  rows={2}
                  className="mt-1"
                  disabled // Make existing lists read-only
                />
                {errors.mailingLists?.[index]?.emails && (
                  <p className="text-sm text-destructive">{errors.mailingLists[index]?.emails?.message}</p>
                )}
              </div>
               {/* 
                <Button type="button" variant="destructive" size="sm" onClick={() => remove(index)} className="mt-2" disabled>
                <Trash2 className="mr-2 h-4 w-4" /> Delete List (Disabled)
              </Button> 
              */}
            </div>
          ))}
          {fields.length === 0 && <p className="text-sm text-muted-foreground">No mailing lists configured yet.</p>}
        </CardContent>
      </Card>
      
      <Separator />

      <Card>
        <CardHeader>
            <CardTitle className="text-lg">Add New Mailing List</CardTitle>
            <CardDescription>Create a new recipient list.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div>
                <Label htmlFor="newListName">New List Name</Label>
                <Input id="newListName" {...register("newListName")} placeholder="e.g., Marketing Team" className="mt-1" />
                {errors.newListName && <p className="text-sm text-destructive">{errors.newListName.message}</p>}
            </div>
            <div>
                <Label htmlFor="newListEmails">Emails (comma-separated)</Label>
                <Textarea id="newListEmails" {...register("newListEmails")} placeholder="email1@example.com, email2@example.com" rows={2} className="mt-1" />
                {errors.newListEmails && <p className="text-sm text-destructive">{errors.newListEmails.message}</p>}
            </div>
        </CardContent>
      </Card>


      <Button type="submit" disabled={isLoading || isFetchingLists} className="w-full sm:w-auto">
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Save All Settings
      </Button>
    </form>
  );
}

