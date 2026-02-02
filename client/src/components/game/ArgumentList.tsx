import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';

interface Argument {
  id: string;
  argumentType: 'FOR' | 'AGAINST' | 'CLARIFICATION' | 'INITIATOR_FOR';
  content: string;
  sequence: number;
  createdAt: string;
  player: {
    id: string;
    playerName: string;
    user: { displayName: string };
  };
}

interface ArgumentListProps {
  actionId: string;
}

export function ArgumentList({ actionId }: ArgumentListProps) {
  const { data, isLoading, error } = useQuery<{ data: Argument[] }>({
    queryKey: ['arguments', actionId],
    queryFn: () => api.get(`/actions/${actionId}/arguments`).then((res) => res.data),
    refetchInterval: 5000,
  });

  const args = data?.data || [];

  if (isLoading) {
    return <div className="text-center py-4 text-muted-foreground">Loading arguments...</div>;
  }

  if (error) {
    return <div className="text-center py-4 text-destructive">Failed to load arguments</div>;
  }

  if (args.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        No arguments yet. Be the first to add one!
      </div>
    );
  }

  // Group arguments by player
  const groupedByPlayer = args.reduce<Record<string, Argument[]>>((acc, arg) => {
    const playerId = arg.player.id;
    if (!acc[playerId]) {
      acc[playerId] = [];
    }
    acc[playerId].push(arg);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Arguments ({args.length})</h3>

      <div className="space-y-4">
        {args.map((arg) => (
          <div
            key={arg.id}
            className={`p-3 rounded-md border-l-4 ${
              arg.argumentType === 'FOR' || arg.argumentType === 'INITIATOR_FOR'
                ? 'bg-green-50 border-green-500 dark:bg-green-950'
                : arg.argumentType === 'AGAINST'
                ? 'bg-red-50 border-red-500 dark:bg-red-950'
                : 'bg-blue-50 border-blue-500 dark:bg-blue-950'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">{arg.player.playerName}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  arg.argumentType === 'FOR' || arg.argumentType === 'INITIATOR_FOR'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                    : arg.argumentType === 'AGAINST'
                    ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                }`}
              >
                {arg.argumentType === 'FOR' || arg.argumentType === 'INITIATOR_FOR'
                  ? 'For'
                  : arg.argumentType === 'AGAINST'
                  ? 'Against'
                  : 'Clarification'}
              </span>
            </div>
            <p className="text-sm">{arg.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
