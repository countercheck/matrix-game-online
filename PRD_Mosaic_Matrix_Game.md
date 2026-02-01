# Product Requirements Document (PRD)
## Mosaic Strict Matrix Game - Web Application v1.0

**Document Version:** 1.0  
**Last Updated:** January 31, 2026  
**Product Owner:** [Your Name]

---

## 1. Executive Summary

### 1.1 Product Overview
A web-based implementation of the Mosaic Strict Matrix Game's Action Resolution system, enabling asynchronous, play-by-post gameplay for distributed groups. This version focuses exclusively on the core action resolution mechanics, deferring the Initiative Auction and Secret Actions to future releases.

### 1.2 Target Users
- Tabletop RPG players seeking GM-less play
- Online gaming groups who can't meet synchronously
- Matrix game enthusiasts
- Game designers testing narrative systems

### 1.3 Core Value Proposition
Eliminates physical token management and enables remote play for a collaborative storytelling/wargaming system that traditionally requires in-person play with physical components.

---

## 2. Goals & Success Metrics

### 2.1 Primary Goals
1. Enable asynchronous play of the Action Resolution mechanic
2. Accurately implement the token-based voting and drawing system
3. Provide clear state visibility for all players
4. Support 2+ concurrent players per game

### 2.2 Success Metrics
- Users can complete an action resolution cycle in < 5 minutes of active engagement
- 90%+ of test games complete without technical errors
- Average time-to-complete-action < 24 hours
- User comprehension of game state ≥ 85% (via user testing)

### 2.3 Out of Scope (v1)
- Initiative Auction system
- Secret actions
- Real-time/synchronous play
- Mobile native apps (mobile-responsive web only)
- Voice/video integration
- AI-assisted narration
- Campaign/persistent world features

---

## 3. User Stories & Requirements

### 3.1 Epic: Game Creation & Management

**US-001: Create Game**
- **As a** player
- **I want to** create a new game session
- **So that** I can invite others to play with me

**Acceptance Criteria:**
- User can set a game name
- User can optionally set a game description/setting
- User is automatically added as the first player
- System generates a unique game code/link for sharing
- Minimum 2 players required to start

**US-002: Join Game**
- **As a** player
- **I want to** join an existing game via invite link/code
- **So that** I can participate with my group

**Acceptance Criteria:**
- User can join via shareable link or game code
- User can set/edit their player name for this game
- User sees who else has joined
- Host can start game once minimum players (2) have joined

**US-003: View Active Games**
- **As a** player
- **I want to** see all games I'm participating in
- **So that** I can track my ongoing sessions

**Acceptance Criteria:**
- Dashboard shows all active games
- Shows game status (waiting for players, active, paused, completed)
- Shows whose turn it is / what phase the game is in
- Shows last activity timestamp

### 3.2 Epic: Action Resolution Cycle

**US-004: Propose Action**
- **As a** player (Initiator)
- **I want to** propose an action and argue for its success
- **So that** I can advance the narrative

**Acceptance Criteria:**
- User can volunteer to be Initiator (or game assigns rotation)
- Text field for action description (required)
- Text field for desired outcome (required)
- Text area for up to 3 arguments for success (configurable limit)
- Character limits on fields (action: 500 chars, outcome: 300 chars, argument: 200 chars each)
- Submit button advances to Argumentation phase

**US-005: Argue For/Against**
- **As a** non-Initiator player
- **I want to** provide arguments for or against the proposed action
- **So that** I can influence the outcome

**Acceptance Criteria:**
- All non-Initiator players can add arguments
- Each player can add multiple arguments (suggested limit: 3)
- Arguments labeled as "For" or "Against"
- Arguments display with player name
- Initiator can add one clarifying statement after others argue
- Phase advances when all players mark arguments complete OR timeout (24hr)

**US-006: Vote on Outcome**
- **As a** player
- **I want to** vote on the likelihood of success
- **So that** the system can determine the result

**Acceptance Criteria:**
- All players (including Initiator) must vote
- Three voting options:
  - Likely Success (adds 2 Success tokens)
  - Likely Failure (adds 2 Failure tokens)
  - Uncertain (adds 1 Success, 1 Failure)
- Votes are hidden until all submitted
- Visual representation of voting options with clear labels
- Cannot change vote after submission
- Phase advances when all votes submitted OR timeout (24hr)

**US-007: Draw Tokens & Resolve**
- **As an** Initiator
- **I want to** draw tokens to determine the outcome
- **So that** the action is resolved

**Acceptance Criteria:**
- System displays total token pool composition (before draw)
- Initiator clicks "Draw" button
- System randomly draws 3 tokens (cryptographically fair)
- Visual animation of drawing process
- Clear display of drawn tokens
- Automatic calculation and display of result:
  - 3 Success = +3 Triumph!
  - 2 Success, 1 Failure = +1 Success, but...
  - 1 Success, 2 Failure = -1 Failure, but...
  - 3 Failure = -3 Disaster!
- Result locked and visible to all

**US-008: Narrate Result**
- **As a** player (typically Initiator, but could be collaborative)
- **I want to** narrate what happens based on the result
- **So that** the story progresses

**Acceptance Criteria:**
- Text area for narration (1000 char limit)
- Shows the numeric result prominently
- Can be Initiator-only or open to all (configurable)
- Submit narration completes the action cycle
- Narration is permanent and displayed in history

**US-009: Reset for Next Action**
- **As a** player
- **I want to** the game to reset automatically
- **So that** we can proceed to the next action

**Acceptance Criteria:**
- Token pool resets to base state (1 Success, 1 Failure)
- Player token hands replenished (2 Success, 2 Failure each)
- Action history preserved and viewable
- New action can be proposed
- Notification sent to all players

### 3.3 Epic: Round Management

**US-010: View Current Round Status**
- **As a** player
- **I want to** see which round we're in and who still needs to propose
- **So that** I can track game progress and know when it's my turn

**Acceptance Criteria:**
- Display current round number
- Show which players have/haven't initiated actions this round
- Show actions completed vs total required
- Visual progress indicator

**US-011: Start New Round**
- **As the** system
- **I want to** automatically start a new round after the previous round completes
- **So that** play continues smoothly

**Acceptance Criteria:**
- New round created when previous round summary submitted
- Round number increments
- Total actions required = number of active players
- All players eligible to propose again
- Notification sent to all players

**US-012: Write Round Summary**
- **As a** player (typically host or designated summarizer)
- **I want to** write a summary of what happened this round
- **So that** we can reflect on cumulative outcomes

**Acceptance Criteria:**
- Available only when all actions in round are complete
- Text area for summary (2000 char limit)
- Display all action results from the round
- Show net cumulative result (sum of all result values)
- List key outcomes/events
- Submit summary completes the round
- Summary visible in round history

**US-013: Ensure Fair Turn Order**
- **As a** player
- **I want to** ensure everyone gets to propose once per round
- **So that** play is fair and balanced

**Acceptance Criteria:**
- Each player can only initiate one action per round
- System tracks who has proposed this round
- Cannot start new action if player already proposed this round
- UI shows "Already proposed this round" message if attempted
- Round doesn't complete until all active players have proposed

### 3.4 Epic: Game State & History

**US-014: View Game History**
- **As a** player
- **I want to** review past actions and outcomes
- **So that** I can understand the narrative and make informed decisions

**Acceptance Criteria:**
- Chronological list of completed actions
- Each entry shows:
  - Initiator name
  - Action description
  - Arguments (expandable/collapsible)
  - Vote outcome (aggregated, not individual votes)
  - Result value and type
  - Narration
  - Timestamp
- Search/filter functionality
- Export history (nice-to-have)

**US-015: View Current Game State**
- **As a** player
- **I want to** see the current phase and what's expected of me
- **So that** I know when to act

**Acceptance Criteria:**
- Clear phase indicator (Proposal, Argumentation, Voting, Resolution, Narration)
- Indicator of who needs to act next
- Timer/timestamp of when phase started
- List of who has/hasn't completed their phase action
- Token pool composition visible

**US-016: Receive Notifications**
- **As a** player
- **I want to** be notified when it's my turn
- **So that** I don't hold up the game

**Acceptance Criteria:**
- Email notification when action required
- In-app notification badge
- Notification preferences (immediate, daily digest, none)
- Notification content includes game name and required action

### 3.5 Epic: User Management

**US-017: User Registration/Login**
- **As a** user
- **I want to** create an account and log in
- **So that** I can participate in games

**Acceptance Criteria:**
- Email + password registration
- OAuth (Google, GitHub - nice to have)
- Email verification
- Password reset functionality
- Remember me option

**US-018: User Profile**
- **As a** user
- **I want to** manage my profile
- **So that** other players can identify me

**Acceptance Criteria:**
- Display name (used across all games)
- Email (private)
- Avatar (optional, gravatar integration)
- Notification preferences
- Game history stats (nice-to-have)

---

## 4. Functional Requirements

### 4.1 Game State Machine

Each action progresses through phases:

```
WAITING → PROPOSAL → ARGUMENTATION → VOTING → RESOLUTION → NARRATION → COMPLETE
```

**Action Phase Transitions:**
- WAITING → PROPOSAL: Player proposes action
- PROPOSAL → ARGUMENTATION: Initiator submits action
- ARGUMENTATION → VOTING: All players mark complete OR 24hr timeout
- VOTING → RESOLUTION: All players vote OR 24hr timeout
- RESOLUTION → NARRATION: Initiator draws tokens
- NARRATION → COMPLETE: Narration submitted

**Round Management:**
Each round consists of one action per active player.

**Round State Transitions:**
```
ROUND_START → (multiple actions: PROPOSAL → ... → COMPLETE) → ROUND_SUMMARY → ROUND_COMPLETE → ROUND_START
```

- Game starts: Create Round 1
- Players take turns proposing actions (one per player per round)
- When all players have completed their actions: Transition to ROUND_SUMMARY phase
- After round summary submitted: Complete round, create new round
- New round begins with PROPOSAL phase

**Enforcement:**
- Each player can only initiate one action per round
- Round completes when actions_completed equals number of active players
- System tracks which players have proposed in current round

### 4.2 Token Mechanics

**Base Pool:**
- 1 Success token
- 1 Failure token

**Per Player:**
- 2 Success tokens
- 2 Failure tokens

**Voting:**
- Each player adds 2 tokens based on their vote
- Total pool size = 2 + (2 × number of players)

**Drawing:**
- 3 tokens drawn randomly without replacement
- Cryptographically secure randomness
- Deterministic outcome based on drawn tokens

**Resolution Values:**
- SSS = +3
- SSF = +1
- SFF = -1
- FFF = -3

### 4.3 Data Validation

**Input Validation:**
- Action description: 1-500 characters, required
- Outcome description: 1-300 characters, required
- Arguments: 1-200 characters each, max 3 per player
- Narration: 1-1000 characters, required
- Round summary: 1-2000 characters, required
- Game name: 1-100 characters
- Player name: 1-50 characters

**Business Logic Validation:**
- Minimum 2 players to start
- Cannot vote before argumentation complete
- Cannot draw before all votes submitted
- Cannot narrate before drawing
- Cannot propose new action if already proposed this round
- Cannot write round summary until all actions in round complete
- Cannot start new round before round summary complete

### 4.4 Timeouts & Auto-progression

**Timeout Rules:**
- Argumentation phase: 24 hours from proposal
- Voting phase: 24 hours from argumentation end
- If timeout occurs, missing players get default action:
  - Argumentation: No additional arguments
  - Voting: "Uncertain" (1S, 1F)
- Narration: No timeout (but reminder notifications)

---

## 5. Non-Functional Requirements

### 5.1 Performance
- Page load time < 2 seconds
- Action submission response < 500ms
- Support up to 10 concurrent players per game
- Support up to 100 concurrent games on single instance

### 5.2 Availability
- 99% uptime during business hours
- Graceful degradation if services unavailable
- Data persistence (no data loss on crashes)

### 5.3 Security
- HTTPS only
- Password hashing (bcrypt, min 12 rounds)
- CSRF protection
- XSS prevention
- Rate limiting on API endpoints
- Input sanitization

### 5.4 Usability
- Mobile-responsive design (320px minimum width)
- WCAG 2.1 AA compliance
- Keyboard navigation support
- Clear error messages
- Maximum 3 clicks to any primary function

### 5.5 Browser Support
- Chrome/Edge (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)
- Mobile browsers (iOS Safari, Chrome Android)

---

## 6. User Interface Requirements

### 6.1 Key Screens

**Dashboard:**
- List of active games
- Create game button
- Join game input
- User menu (profile, logout)

**Game Lobby:**
- Game name/description
- Player list (with ready status)
- Invite link/code (copy to clipboard)
- Start game button (host only, min 2 players)

**Game View:**
- Phase indicator
- Action area (context-dependent per phase)
- Game history sidebar (collapsible)
- Player list with action status
- Token pool visualization

**Action Proposal:**
- Form with action, outcome, arguments
- Character counters
- Submit button

**Argumentation:**
- Display proposed action
- Initiator's arguments
- Other players' arguments
- Add argument form
- Mark complete button

**Voting:**
- Display action and all arguments
- Three voting buttons with token visualization
- Submission confirmation
- Waiting indicator for other players

**Resolution:**
- Token pool composition
- Draw button (Initiator only)
- Token draw animation
- Result display

**Narration:**
- Result recap
- Narration form
- Submit button

### 6.2 Design Principles
- Clean, minimal interface
- High contrast text for readability
- Clear visual hierarchy
- Progressive disclosure (show what's relevant)
- Visual feedback for all actions
- Loading states for async operations

---

## 7. Technical Constraints

### 7.1 Must Support
- Asynchronous, non-real-time architecture
- Multiple simultaneous games per user
- Fair random number generation
- State persistence across sessions

### 7.2 Should Avoid
- Heavy client-side state management (server is source of truth)
- Real-time websocket requirements (for v1)
- Complex 3D animations
- Large media files

---

## 8. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Players forget to act | High | Email notifications, push notifications, timeout mechanics |
| Unfair random draws | Medium | Use cryptographically secure RNG, display seed for verification |
| Players abuse system | Medium | Rate limiting, game creator controls |
| Slow async play | Medium | Timeout mechanics, visible timers, notifications |
| Confusion about game state | High | Clear UI, phase indicators, help text |

---

## 9. Future Considerations (v2+)

- Initiative Auction system
- Secret actions
- Real-time mode (optional)
- Mobile apps
- Rich text formatting in narration
- Image/media attachments
- Campaign management
- AI-assisted suggestions
- Spectator mode
- Replays/game analysis

---

## 10. Acceptance Criteria (Release)

**Must Have:**
- [ ] Complete action resolution cycle functional
- [ ] 2+ players can play asynchronously
- [ ] Token mechanics work correctly
- [ ] Game history preserved
- [ ] Mobile-responsive
- [ ] User authentication
- [ ] Email notifications

**Should Have:**
- [ ] Timeout mechanics
- [ ] Game lobby/invite system
- [ ] Player dashboard
- [ ] Help/tutorial

**Nice to Have:**
- [ ] OAuth login
- [ ] Export history
- [ ] Game stats
- [ ] Theme customization

---

## 11. Dependencies

- Email service (SendGrid, AWS SES, etc.)
- Hosting platform (AWS, Vercel, Railway, etc.)
- Database (PostgreSQL preferred)
- Authentication service (can be self-hosted)

---

## Appendix A: Glossary

- **Initiator**: Player proposing and driving the current action
- **Action**: A proposed event or occurrence in the narrative
- **Argument**: A reason for or against an action's success
- **Token**: Virtual representation of Success/Failure in the resolution pool
- **Resolution Pool**: The collection of tokens from which the outcome is drawn
- **Phase**: A step in the action resolution cycle
- **Triumph/Disaster**: Extreme success/failure outcomes (+3/-3)

---

**Document End**
