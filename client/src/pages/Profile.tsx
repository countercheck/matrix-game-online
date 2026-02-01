import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

interface Profile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  notificationPreferences: {
    email?: boolean;
    inApp?: boolean;
    frequency?: string;
  };
}

export default function Profile() {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const { data, isLoading } = useQuery<{ data: Profile }>({
    queryKey: ['profile'],
    queryFn: () => api.get('/users/me').then((res) => res.data),
    onSuccess: (data) => {
      setDisplayName(data.data.displayName);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { displayName: string }) => api.put('/users/me', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setIsEditing(false);
    },
  });

  const profile = data?.data;

  if (isLoading) {
    return <div className="text-center py-12">Loading profile...</div>;
  }

  if (!profile) {
    return <div className="text-center py-12 text-destructive">Failed to load profile</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>

      <div className="p-6 border rounded-lg space-y-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground">Email</label>
          <p className="mt-1">{profile.email}</p>
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">Display Name</label>
          {isEditing ? (
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-md bg-background"
                maxLength={50}
              />
              <button
                onClick={() => updateMutation.mutate({ displayName })}
                disabled={updateMutation.isPending}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setDisplayName(profile.displayName);
                  setIsEditing(false);
                }}
                className="px-4 py-2 border rounded-md hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="mt-1 flex items-center gap-2">
              <p>{profile.displayName}</p>
              <button
                onClick={() => setIsEditing(true)}
                className="text-sm text-primary hover:underline"
              >
                Edit
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Member since
          </label>
          <p className="mt-1 text-muted-foreground">
            {new Date(profile.id).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="p-6 border rounded-lg space-y-4">
        <h2 className="text-lg font-semibold">Notification Preferences</h2>
        <p className="text-sm text-muted-foreground">
          Configure how you receive notifications about game activity.
        </p>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={profile.notificationPreferences?.email !== false}
              disabled
              className="rounded"
            />
            <span className="text-sm">Email notifications</span>
          </label>
          <p className="text-xs text-muted-foreground ml-6">
            Notification settings coming soon
          </p>
        </div>
      </div>
    </div>
  );
}
