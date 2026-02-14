import { useState, useEffect } from 'react';

interface PhaseCountdownProps {
  phaseStartedAt?: string | null;
  timeoutHours?: number;
  currentPhase: string;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Timed out';

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export function PhaseCountdown({
  phaseStartedAt,
  timeoutHours,
  currentPhase,
}: PhaseCountdownProps) {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  // Phases that don't have countdowns
  const nonTimedPhases = ['WAITING', 'RESOLUTION', 'ROUND_SUMMARY', 'COMPLETED'];

  const isInfinite = timeoutHours === undefined || timeoutHours === -1;
  const shouldShow =
    !isInfinite &&
    phaseStartedAt &&
    !nonTimedPhases.includes(currentPhase);

  useEffect(() => {
    if (!shouldShow || !phaseStartedAt || timeoutHours === undefined) {
      return;
    }

    const deadline = new Date(phaseStartedAt).getTime() + timeoutHours * 3600000;

    const tick = () => {
      const remaining = deadline - Date.now();
      setRemainingMs(Math.max(0, remaining));
    };

    tick(); // initial
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [shouldShow, phaseStartedAt, timeoutHours]);

  if (!shouldShow || remainingMs === null) {
    return null;
  }

  const isExpired = remainingMs <= 0;
  const totalMs = (timeoutHours ?? 0) * 3600000;
  const fraction = totalMs > 0 ? remainingMs / totalMs : 0;

  // Color based on remaining time
  let colorClass: string;
  if (isExpired) {
    colorClass = 'text-red-600 dark:text-red-400';
  } else if (fraction < 0.1) {
    colorClass = 'text-red-600 dark:text-red-400';
  } else if (fraction < 0.25) {
    colorClass = 'text-amber-600 dark:text-amber-400';
  } else {
    colorClass = 'text-muted-foreground';
  }

  return (
    <span className={`text-xs font-mono ${colorClass}`} title="Time remaining in phase">
      {isExpired ? 'Timed out' : formatRemaining(remainingMs)}
    </span>
  );
}
