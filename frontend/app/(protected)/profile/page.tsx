"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProfilePage() {
  const user = useQuery(api.users.currentUser);
  const updateProfile = useMutation(api.users.updateProfile);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const updateEmailPrefs = useMutation(api.users.updateEmailPrefs);
  const [prefsSaved, setPrefsSaved] = useState(false);
  const [prefsError, setPrefsError] = useState<string | null>(null);
  const [prefsLoading, setPrefsLoading] = useState(false);

  if (user === undefined) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setLoading(true);
    const data = new FormData(e.currentTarget);
    try {
      await updateProfile({
        fullName: (data.get("fullName") as string).trim(),
        streetAddress: (data.get("streetAddress") as string).trim(),
        city: (data.get("city") as string).trim(),
        state: (data.get("state") as string).trim(),
        zip: (data.get("zip") as string).trim(),
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setLoading(false);
    }
  };

  const handlePrefsSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPrefsError(null);
    setPrefsSaved(false);
    setPrefsLoading(true);
    const data = new FormData(e.currentTarget);
    const reminderEmailValue = (data.get("reminderEmail") as string).trim();
    try {
      await updateEmailPrefs({
        emailRemindersEnabled: data.get("emailRemindersEnabled") === "on",
        reminderEmail: reminderEmailValue || undefined,
      });
      setPrefsSaved(true);
    } catch (err) {
      setPrefsError(err instanceof Error ? err.message : "Failed to save preferences.");
    } finally {
      setPrefsLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Your name and address will appear on dispute letters. Required before generating letters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                name="fullName"
                defaultValue={user?.fullName ?? ""}
                placeholder="Jane Smith"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="streetAddress">Street Address</Label>
              <Input
                id="streetAddress"
                name="streetAddress"
                defaultValue={user?.streetAddress ?? ""}
                placeholder="123 Main St"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  name="city"
                  defaultValue={user?.city ?? ""}
                  placeholder="Springfield"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  name="state"
                  defaultValue={user?.state ?? ""}
                  placeholder="IL"
                  maxLength={2}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip">ZIP Code</Label>
              <Input
                id="zip"
                name="zip"
                defaultValue={user?.zip ?? ""}
                placeholder="62701"
                pattern="[0-9]{5}(-[0-9]{4})?"
                required
              />
            </div>

            {saved && (
              <p className="text-sm text-green-600">Profile saved successfully.</p>
            )}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Profile"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Email Reminders</CardTitle>
          <CardDescription>
            Receive email reminders before dispute deadlines and after 30 days with no bureau response.
            Reminder timing: day 25 (approaching) and day 31 (overdue).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePrefsSubmit} className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="emailRemindersEnabled"
                name="emailRemindersEnabled"
                defaultChecked={user?.emailRemindersEnabled !== false}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="emailRemindersEnabled">Enable email reminders</Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reminderEmail">Reminder email address (optional)</Label>
              <Input
                id="reminderEmail"
                name="reminderEmail"
                type="email"
                defaultValue={user?.reminderEmail ?? ""}
                placeholder="Defaults to your login email"
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to use your login email: {user?.email ?? ""}
              </p>
            </div>
            {prefsSaved && (
              <p className="text-sm text-green-600">Preferences saved.</p>
            )}
            {prefsError && (
              <p className="text-sm text-red-600">{prefsError}</p>
            )}
            <Button type="submit" disabled={prefsLoading}>
              {prefsLoading ? "Saving..." : "Save Preferences"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
