import { useState } from 'react';

function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="border rounded-lg">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between text-left font-semibold hover:bg-muted/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        aria-expanded={isOpen}
      >
        <span>{title}</span>
        <svg
          className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 space-y-3 text-sm text-muted-foreground">{children}</div>
      )}
    </section>
  );
}

export default function Help() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">How to Play</h1>
      <p className="text-muted-foreground">
        Learn how the Mosaic Matrix Game works, from creating a game to resolving actions.
      </p>

      <Section title="Game Overview" defaultOpen>
        <p>
          The Mosaic Matrix Game is a collaborative, asynchronous play-by-post game where players
          propose actions, debate their merits, and resolve outcomes through a token-drawing system.
        </p>
        <p>
          Players take turns proposing actions within a shared narrative. Other players argue for or
          against each action, then vote on its likelihood of success. The votes shape a pool of
          tokens, and a random draw determines the final outcome.
        </p>
      </Section>

      <Section title="Getting Started">
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong className="text-foreground">Create a game:</strong> Click &quot;Create
            Game&quot; from the dashboard. Give your game a name and optional description.
          </li>
          <li>
            <strong className="text-foreground">Invite players:</strong> Share the invite link with
            others so they can join your game lobby.
          </li>
          <li>
            <strong className="text-foreground">Join a game:</strong> Use an invite link to join
            someone else&apos;s game. Choose a persona name for your character.
          </li>
          <li>
            <strong className="text-foreground">Start the game:</strong> The host starts the game
            once at least 2 players have joined.
          </li>
        </ul>
      </Section>

      <Section title="Game Flow">
        <p>The game proceeds in rounds. Each round follows this cycle:</p>
        <ol className="list-decimal pl-5 space-y-2">
          <li>
            <strong className="text-foreground">Propose actions:</strong> Every player proposes one
            action for their character during the round.
          </li>
          <li>
            <strong className="text-foreground">Resolve actions:</strong> Each action goes through
            the resolution phases (see below) one at a time.
          </li>
          <li>
            <strong className="text-foreground">Round summary:</strong> After all actions are
            resolved, someone writes a summary of what happened during the round.
          </li>
          <li>
            <strong className="text-foreground">Next round:</strong> A new round begins and the
            cycle repeats.
          </li>
        </ol>
      </Section>

      <Section title="Action Resolution Phases">
        <p>Each proposed action goes through five phases:</p>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
              1
            </span>
            <div>
              <strong className="text-foreground">Proposal</strong>
              <p className="mt-0.5">
                The initiator proposes an action, describes the desired outcome, and provides
                supporting arguments.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
              2
            </span>
            <div>
              <strong className="text-foreground">Argumentation</strong>
              <p className="mt-0.5">
                Other players submit arguments for or against the action, or ask for clarification.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
              3
            </span>
            <div>
              <strong className="text-foreground">Voting</strong>
              <p className="mt-0.5">
                All players vote on the action: Likely Success, Likely Failure, or Uncertain. Votes
                determine the composition of the token pool.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
              4
            </span>
            <div>
              <strong className="text-foreground">Resolution</strong>
              <p className="mt-0.5">
                The initiator draws 3 tokens from the pool to determine the outcome (see Token
                Mechanics below).
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
              5
            </span>
            <div>
              <strong className="text-foreground">Narration</strong>
              <p className="mt-0.5">
                The initiator narrates what happens based on the token draw result, weaving the
                outcome into the shared story.
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Token Mechanics">
        <p>
          The token system determines the outcome of each action. The pool of tokens is built from a
          base set plus contributions from each player&apos;s vote.
        </p>

        <div className="space-y-2">
          <h3 className="font-semibold text-foreground text-base">Building the Pool</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong className="text-foreground">Base pool:</strong> 1 Success token + 1 Failure
              token
            </li>
            <li>
              <strong className="text-foreground">Likely Success vote:</strong> adds 2 Success
              tokens
            </li>
            <li>
              <strong className="text-foreground">Likely Failure vote:</strong> adds 2 Failure
              tokens
            </li>
            <li>
              <strong className="text-foreground">Uncertain vote:</strong> adds 1 Success + 1
              Failure token
            </li>
          </ul>
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold text-foreground text-base">Drawing Tokens</h3>
          <p>3 tokens are drawn randomly from the pool. The combination determines the result:</p>
        </div>

        <div className="grid gap-2">
          <div className="flex items-center gap-3 p-2 rounded-md bg-green-100 dark:bg-green-900/30">
            <span className="font-mono font-bold text-green-700 dark:text-green-300 w-8 text-right">
              +3
            </span>
            <span className="text-green-700 dark:text-green-300">
              <strong>Triumph!</strong> &mdash; 3 Success tokens drawn
            </span>
          </div>
          <div className="flex items-center gap-3 p-2 rounded-md bg-blue-100 dark:bg-blue-900/30">
            <span className="font-mono font-bold text-blue-700 dark:text-blue-300 w-8 text-right">
              +1
            </span>
            <span className="text-blue-700 dark:text-blue-300">
              <strong>Success, but...</strong> &mdash; 2 Success + 1 Failure
            </span>
          </div>
          <div className="flex items-center gap-3 p-2 rounded-md bg-orange-100 dark:bg-orange-900/30">
            <span className="font-mono font-bold text-orange-700 dark:text-orange-300 w-8 text-right">
              -1
            </span>
            <span className="text-orange-700 dark:text-orange-300">
              <strong>Failure, but...</strong> &mdash; 1 Success + 2 Failure
            </span>
          </div>
          <div className="flex items-center gap-3 p-2 rounded-md bg-red-100 dark:bg-red-900/30">
            <span className="font-mono font-bold text-red-700 dark:text-red-300 w-8 text-right">
              -3
            </span>
            <span className="text-red-700 dark:text-red-300">
              <strong>Disaster!</strong> &mdash; 3 Failure tokens drawn
            </span>
          </div>
        </div>
      </Section>

      <Section title="Key Terms">
        <dl className="space-y-3">
          <div>
            <dt className="font-semibold text-foreground">Host</dt>
            <dd>
              The player who created the game. The host can start the game and manage settings.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Round</dt>
            <dd>
              A cycle in which every player proposes and resolves one action, ending with a round
              summary.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Action</dt>
            <dd>
              A proposed event or deed by a player&apos;s character, resolved through the
              argumentation, voting, and token-drawing process.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Argument</dt>
            <dd>
              A statement submitted by a player during the argumentation phase, either supporting
              (For), opposing (Against), or seeking more information (Clarification).
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Vote</dt>
            <dd>
              Each player&apos;s assessment of an action&apos;s likelihood: Likely Success, Likely
              Failure, or Uncertain. Votes determine the token pool composition.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Token</dt>
            <dd>
              Success or Failure markers placed in a pool and drawn randomly to determine action
              outcomes.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Initiator</dt>
            <dd>
              The player who proposed an action. The initiator draws tokens and narrates the result.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Persona</dt>
            <dd>
              The character name a player uses within a game. Each player chooses a persona when
              joining.
            </dd>
          </div>
        </dl>
      </Section>
    </div>
  );
}
