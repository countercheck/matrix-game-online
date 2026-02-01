# Mosaic Strict Matrix Game - Development Plan
## Actionable Task Checklist

**Version:** 1.0  
**Last Updated:** January 31, 2026  
**Estimated Total Time:** 8-12 weeks (1-2 developers)

---

## Legend
- [ ] Not started
- [→] In progress
- [✓] Completed
- [⚠] Blocked/needs attention
- [*] Optional/nice-to-have

---

## Phase 0: Project Setup & Infrastructure
**Estimated Time:** 3-5 days

### 0.1 Repository & Tooling Setup
- [ ] Create GitHub repository
- [ ] Initialize monorepo structure (or separate repos for frontend/backend)
- [ ] Set up `.gitignore` for Node.js, environment files
- [ ] Create `README.md` with project overview
- [ ] Set up branch protection rules (main/develop)
- [ ] Configure GitHub Projects or issue tracker

### 0.2 Backend Project Setup
- [ ] Initialize Node.js project with TypeScript (`npm init`, `pnpm init`)
- [ ] Install core dependencies: Express, TypeScript, ts-node
- [ ] Configure `tsconfig.json` for backend
- [ ] Set up ESLint configuration
- [ ] Set up Prettier configuration
- [ ] Create basic folder structure (src/routes, src/controllers, etc.)
- [ ] Set up nodemon for development hot-reload
- [ ] Create `.env.example` file

### 0.3 Frontend Project Setup
- [ ] Initialize Vite + React + TypeScript project
- [ ] Install core dependencies: React Router, React Query, Axios
- [ ] Configure `tsconfig.json` for frontend
- [ ] Set up Tailwind CSS
- [ ] Install UI library (Radix UI or shadcn/ui)
- [ ] Set up ESLint and Prettier
- [ ] Create basic folder structure
- [ ] Configure path aliases (@components, @utils, etc.)

### 0.4 Database Setup
- [ ] Install PostgreSQL locally (or use Docker)
- [ ] Create development database
- [ ] Install Prisma or Drizzle ORM
- [ ] Initialize ORM configuration
- [ ] Test database connection

### 0.5 Development Environment
- [ ] Set up Docker Compose for local development (optional but recommended)
- [ ] Create docker-compose.yml with Postgres, Redis
- [ ] Test Docker setup
- [ ] Document setup instructions in README

---

## Phase 1: Database Schema & Models
**Estimated Time:** 3-4 days

### 1.1 Core Schema Definition
- [ ] Define User model/schema
- [ ] Define Game model/schema
- [ ] Define GamePlayer model/schema
- [ ] Define Round model/schema
- [ ] Define Action model/schema
- [ ] Define Argument model/schema
- [ ] Define Vote model/schema
- [ ] Define TokenDraw model/schema
- [ ] Define DrawnToken model/schema
- [ ] Define Narration model/schema
- [ ] Define RoundSummary model/schema
- [ ] Define GameEvent model/schema

### 1.2 Relationships & Constraints
- [ ] Add foreign key relationships
- [ ] Add unique constraints
- [ ] Add check constraints
- [ ] Add default values
- [ ] Add indexes for performance

### 1.3 Initial Migration
- [ ] Create initial migration
- [ ] Run migration on development database
- [ ] Verify all tables created correctly
- [ ] Test rollback migration

### 1.4 Seed Data (for development)
- [ ] Create seed script for test users
- [ ] Create seed script for test game
- [ ] Create seed script for test round
- [ ] Run and verify seed data

---

## Phase 2: Backend - Authentication & User Management
**Estimated Time:** 4-5 days

### 2.1 Authentication Infrastructure
- [ ] Install bcrypt, jsonwebtoken, zod
- [ ] Create password hashing utility functions
- [ ] Create JWT token generation functions
- [ ] Create JWT token verification functions
- [ ] Create authentication middleware
- [ ] Create error handling middleware

### 2.2 User Registration
- [ ] Create user registration validation schema (Zod)
- [ ] Create user registration controller
- [ ] Create user registration service
- [ ] Create POST /api/auth/register endpoint
- [ ] Test registration with valid data
- [ ] Test registration with invalid data
- [ ] Test duplicate email handling

### 2.3 User Login
- [ ] Create login validation schema
- [ ] Create login controller
- [ ] Create login service
- [ ] Create POST /api/auth/login endpoint
- [ ] Test login with valid credentials
- [ ] Test login with invalid credentials
- [ ] Test JWT token generation

### 2.4 User Profile
- [ ] Create GET /api/users/me endpoint
- [ ] Create PUT /api/users/me endpoint
- [ ] Create profile update validation schema
- [ ] Test profile retrieval
- [ ] Test profile updates

### 2.5 Password Reset (Optional for v1)
- [*] Create forgot password endpoint
- [*] Create reset password endpoint
- [*] Integrate email service for reset links

---

## Phase 3: Backend - Game Management
**Estimated Time:** 5-6 days

### 3.1 Game Creation
- [ ] Create game creation validation schema
- [ ] Create game creation controller
- [ ] Create game creation service
- [ ] Create POST /api/games endpoint
- [ ] Auto-add creator as first player (host)
- [ ] Test game creation
- [ ] Test game settings validation

### 3.2 Game Joining
- [ ] Create join game validation schema
- [ ] Create POST /api/games/:gameId/join endpoint
- [ ] Check for duplicate players
- [ ] Validate game is in LOBBY status
- [ ] Test joining game
- [ ] Test joining full/started games (should fail)

### 3.3 Game Starting
- [ ] Create POST /api/games/:gameId/start endpoint
- [ ] Validate minimum 2 players
- [ ] Validate caller is host
- [ ] Create first round automatically
- [ ] Set game status to ACTIVE
- [ ] Set game phase to PROPOSAL
- [ ] Test game start
- [ ] Test non-host trying to start (should fail)

### 3.4 Game Retrieval
- [ ] Create GET /api/games/:gameId endpoint
- [ ] Include players, current round, current action
- [ ] Create GET /api/users/me/games endpoint (user's games)
- [ ] Test game retrieval
- [ ] Test authorization (only players can view)

### 3.5 Game State
- [ ] Create phase transition validation
- [ ] Create phase transition service
- [ ] Create game event logging
- [ ] Test phase transitions
- [ ] Test invalid transitions (should fail)

---

## Phase 4: Backend - Round Management
**Estimated Time:** 3-4 days

### 4.1 Round Creation
- [ ] Create round creation service
- [ ] Auto-create Round 1 when game starts
- [ ] Set total_actions_required = active player count
- [ ] Test round creation

### 4.2 Round Status
- [ ] Create GET /api/rounds/:roundId endpoint
- [ ] Include actions completed count
- [ ] Include list of players who haven't proposed yet
- [ ] Test round status retrieval

### 4.3 Round Completion Logic
- [ ] Create service to check if round is complete
- [ ] Increment actions_completed when action narrated
- [ ] Trigger ROUND_SUMMARY phase when complete
- [ ] Test round completion detection

### 4.4 Round Summary
- [ ] Create round summary validation schema
- [ ] Create POST /api/rounds/:roundId/summary endpoint
- [ ] Create GET /api/rounds/:roundId/summary endpoint
- [ ] Store structured outcomes JSON
- [ ] Test summary creation
- [ ] Test summary retrieval

### 4.5 New Round Creation
- [ ] Auto-create next round after summary
- [ ] Increment round_number
- [ ] Reset actions_completed to 0
- [ ] Transition game to PROPOSAL phase
- [ ] Test automatic round progression

---

## Phase 5: Backend - Action Resolution System
**Estimated Time:** 6-7 days

### 5.1 Action Proposal
- [ ] Create action proposal validation schema
- [ ] Create POST /api/games/:gameId/actions endpoint
- [ ] Check player hasn't already proposed this round
- [ ] Create action with status PROPOSED
- [ ] Store initial arguments
- [ ] Transition to ARGUMENTATION phase
- [ ] Test action creation
- [ ] Test duplicate proposal prevention

### 5.2 Argumentation
- [ ] Create argument validation schema
- [ ] Create POST /api/actions/:actionId/arguments endpoint
- [ ] Create GET /api/actions/:actionId/arguments endpoint
- [ ] Validate argument types (FOR, AGAINST, CLARIFICATION)
- [ ] Enforce argument limits per player
- [ ] Test adding arguments
- [ ] Test argument limits

### 5.3 Voting
- [ ] Create vote validation schema
- [ ] Create POST /api/actions/:actionId/votes endpoint
- [ ] Create GET /api/actions/:actionId/votes endpoint
- [ ] Map vote types to token counts
- [ ] Enforce one vote per player
- [ ] Test vote submission
- [ ] Test duplicate voting (should fail)

### 5.4 Token Drawing
- [ ] Create cryptographically secure random function
- [ ] Create token pool calculation
- [ ] Create token drawing algorithm
- [ ] Create POST /api/actions/:actionId/draw endpoint
- [ ] Store drawn tokens and result
- [ ] Validate only initiator can draw
- [ ] Test token drawing
- [ ] Test result calculation accuracy
- [ ] Test edge cases (all success, all failure)

### 5.5 Narration
- [ ] Create narration validation schema
- [ ] Create POST /api/actions/:actionId/narration endpoint
- [ ] Create GET /api/actions/:actionId/narration endpoint
- [ ] Validate only after tokens drawn
- [ ] Mark action as NARRATED
- [ ] Increment round.actions_completed
- [ ] Test narration creation
- [ ] Test action completion

### 5.6 Action History
- [ ] Create GET /api/games/:gameId/history endpoint
- [ ] Include all completed actions with details
- [ ] Sort by sequence_number
- [ ] Test history retrieval
- [ ] Test pagination (optional)

---

## Phase 6: Backend - Timeout System
**Estimated Time:** 3-4 days

### 6.1 Timeout Infrastructure
- [ ] Install cron or node-cron library
- [ ] Create timeout worker setup
- [ ] Create timeout checking logic
- [ ] Test worker scheduling

### 6.2 Argumentation Timeout
- [ ] Check for actions in ARGUING status > 24 hours
- [ ] Auto-transition to VOTING
- [ ] Log timeout event
- [ ] Test argumentation timeout

### 6.3 Voting Timeout
- [ ] Check for actions in VOTING status > 24 hours
- [ ] Find players who haven't voted
- [ ] Auto-cast UNCERTAIN votes for missing players
- [ ] Transition to RESOLUTION
- [ ] Log timeout event
- [ ] Test voting timeout

### 6.4 Timeout Notifications
- [ ] Send reminder emails before timeout
- [ ] Send notification when timeout occurs
- [ ] Test notification delivery

---

## Phase 7: Backend - Notification System
**Estimated Time:** 3-4 days

### 7.1 Email Service Setup
- [ ] Choose email provider (SendGrid, AWS SES, etc.)
- [ ] Install nodemailer
- [ ] Configure SMTP settings
- [ ] Create email templates
- [ ] Create email sending service
- [ ] Test email delivery

### 7.2 Game Event Notifications
- [ ] Notify players when action proposed
- [ ] Notify players when argumentation phase starts
- [ ] Notify players when voting phase starts
- [ ] Notify initiator when resolution ready
- [ ] Notify players when round summary needed
- [ ] Notify players when new round starts
- [ ] Test all notification triggers

### 7.3 Notification Preferences
- [ ] Create PUT /api/users/me/notifications endpoint
- [ ] Store preferences in user.notification_preferences
- [ ] Respect user preferences when sending
- [ ] Test preference updates
- [ ] Test preference enforcement

---

## Phase 8: Backend - Security & Validation
**Estimated Time:** 2-3 days

### 8.1 Input Sanitization
- [ ] Install DOMPurify or similar
- [ ] Create sanitization middleware
- [ ] Apply to all input endpoints
- [ ] Test XSS prevention

### 8.2 Rate Limiting
- [ ] Install express-rate-limit
- [ ] Configure general rate limiter
- [ ] Configure auth rate limiter
- [ ] Configure action rate limiter
- [ ] Test rate limits

### 8.3 CSRF Protection
- [ ] Install csurf
- [ ] Configure CSRF middleware
- [ ] Add CSRF tokens to responses
- [ ] Test CSRF protection

### 8.4 Authorization
- [ ] Create game membership middleware
- [ ] Create host-only middleware
- [ ] Create initiator-only middleware
- [ ] Apply to protected endpoints
- [ ] Test authorization

---

## Phase 9: Frontend - Core Setup & Routing
**Estimated Time:** 2-3 days

### 9.1 API Client Setup
- [ ] Create Axios instance with base URL
- [ ] Add auth token interceptor
- [ ] Add error interceptor
- [ ] Create API service functions
- [ ] Test API client

### 9.2 Authentication Context
- [ ] Create AuthContext
- [ ] Create useAuth hook
- [ ] Implement login function
- [ ] Implement logout function
- [ ] Implement token storage
- [ ] Test auth context

### 9.3 React Query Setup
- [ ] Configure QueryClient
- [ ] Set up global query defaults
- [ ] Create query key factory
- [ ] Test query setup

### 9.4 Routing
- [ ] Set up React Router
- [ ] Create route structure
- [ ] Create protected route component
- [ ] Create public route component
- [ ] Test navigation
- [ ] Test route protection

---

## Phase 10: Frontend - Authentication UI
**Estimated Time:** 3-4 days

### 10.1 Login Page
- [ ] Create Login component
- [ ] Create login form with validation
- [ ] Connect to login API
- [ ] Handle success/error states
- [ ] Redirect after login
- [ ] Test login flow

### 10.2 Registration Page
- [ ] Create Register component
- [ ] Create registration form with validation
- [ ] Connect to registration API
- [ ] Handle success/error states
- [ ] Redirect after registration
- [ ] Test registration flow

### 10.3 Profile Page
- [ ] Create Profile component
- [ ] Display user information
- [ ] Create edit profile form
- [ ] Connect to update API
- [ ] Test profile updates

---

## Phase 11: Frontend - Game Management UI
**Estimated Time:** 4-5 days

### 11.1 Dashboard
- [ ] Create Dashboard component
- [ ] Display user's active games
- [ ] Create game button
- [ ] Join game button
- [ ] Test dashboard

### 11.2 Create Game
- [ ] Create CreateGame component
- [ ] Create game form
- [ ] Connect to create game API
- [ ] Show invite link after creation
- [ ] Redirect to game lobby
- [ ] Test game creation

### 11.3 Game Lobby
- [ ] Create GameLobby component
- [ ] Display game name and description
- [ ] Display player list
- [ ] Show invite link with copy button
- [ ] Start game button (host only)
- [ ] Test lobby functionality
- [ ] Test real-time player updates (polling)

### 11.4 Join Game
- [ ] Create JoinGame component
- [ ] Handle invite links
- [ ] Enter player name
- [ ] Connect to join API
- [ ] Redirect to lobby
- [ ] Test join flow

---

## Phase 12: Frontend - Game View & Phase Indicator
**Estimated Time:** 3-4 days

### 12.1 Game Layout
- [ ] Create GameView component
- [ ] Create game header with name/round info
- [ ] Create main game area
- [ ] Create sidebar for history
- [ ] Test layout responsiveness

### 12.2 Phase Indicator
- [ ] Create PhaseIndicator component
- [ ] Display current phase
- [ ] Show who needs to act
- [ ] Show progress indicators
- [ ] Test phase display

### 12.3 Round Status
- [ ] Create RoundStatus component
- [ ] Display round number
- [ ] Show actions completed / required
- [ ] List players who haven't proposed
- [ ] Test round status display

### 12.4 Game State Polling
- [ ] Set up React Query polling (5-10 seconds)
- [ ] Fetch current game state
- [ ] Update UI when state changes
- [ ] Test state updates

---

## Phase 13: Frontend - Action Proposal
**Estimated Time:** 3-4 days

### 13.1 Action Proposal Form
- [ ] Create ActionProposal component
- [ ] Create action description input
- [ ] Create desired outcome input
- [ ] Create initial arguments inputs (up to 3)
- [ ] Add character counters
- [ ] Connect to propose action API
- [ ] Test proposal submission

### 13.2 Proposal Validation
- [ ] Check if player already proposed this round
- [ ] Show error if already proposed
- [ ] Disable form if already proposed
- [ ] Test validation

### 13.3 Proposal Display
- [ ] Show proposed action details
- [ ] Show initiator name
- [ ] Show initial arguments
- [ ] Test display

---

## Phase 14: Frontend - Argumentation
**Estimated Time:** 3-4 days

### 14.1 Argument List
- [ ] Create ArgumentList component
- [ ] Display all arguments
- [ ] Group by player
- [ ] Show argument type (FOR/AGAINST/CLARIFICATION)
- [ ] Test argument display

### 14.2 Add Argument
- [ ] Create AddArgument component
- [ ] Argument content input
- [ ] Argument type selector
- [ ] Character counter
- [ ] Connect to add argument API
- [ ] Test adding arguments

### 14.3 Argumentation Complete
- [ ] Create "Done Arguing" button
- [ ] Track who has completed
- [ ] Show who's still needed
- [ ] Auto-advance when all done
- [ ] Test completion

---

## Phase 15: Frontend - Voting
**Estimated Time:** 3-4 days

### 15.1 Voting Panel
- [ ] Create VotingPanel component
- [ ] Display action and arguments summary
- [ ] Create three vote buttons
- [ ] Show token visualization for each option
- [ ] Disable buttons after voting
- [ ] Test vote selection

### 15.2 Vote Submission
- [ ] Connect to vote API
- [ ] Handle success/error
- [ ] Show confirmation
- [ ] Lock in vote (no changes)
- [ ] Test vote submission

### 15.3 Vote Status
- [ ] Show who has/hasn't voted
- [ ] Don't show individual votes (hidden)
- [ ] Show when all votes submitted
- [ ] Test vote status display

---

## Phase 16: Frontend - Token Drawing
**Estimated Time:** 3-4 days

### 16.1 Token Pool Display
- [ ] Create TokenPool component
- [ ] Show total success tokens
- [ ] Show total failure tokens
- [ ] Visual representation (icons/colors)
- [ ] Test pool display

### 16.2 Draw Interface
- [ ] Create TokenDraw component
- [ ] Show "Draw Tokens" button (initiator only)
- [ ] Connect to draw API
- [ ] Test draw trigger

### 16.3 Draw Animation
- [ ] Create drawing animation
- [ ] Show tokens being drawn one by one
- [ ] Display final result
- [ ] Show result type (Triumph, Success but, etc.)
- [ ] Test animation

### 16.4 Result Display
- [ ] Create ResultDisplay component
- [ ] Show drawn tokens
- [ ] Show numeric result (-3 to +3)
- [ ] Show result type with appropriate styling
- [ ] Test result display

---

## Phase 17: Frontend - Narration
**Estimated Time:** 2-3 days

### 17.1 Narration Form
- [ ] Create NarrationForm component
- [ ] Show action result
- [ ] Create narration text area
- [ ] Character counter (1000 chars)
- [ ] Connect to narration API
- [ ] Test narration submission

### 17.2 Narration Display
- [ ] Show narration with action
- [ ] Display author name
- [ ] Format nicely
- [ ] Test display

---

## Phase 18: Frontend - Round Summary
**Estimated Time:** 3-4 days

### 18.1 Round Summary Trigger
- [ ] Detect when round is complete
- [ ] Show round summary form
- [ ] Restrict to appropriate player (host/designated)
- [ ] Test trigger

### 18.2 Round Summary Form
- [ ] Create RoundSummaryForm component
- [ ] Display all action results from round
- [ ] Show net cumulative result
- [ ] Create summary text area (2000 chars)
- [ ] Optional: Add structured outcomes fields
- [ ] Connect to summary API
- [ ] Test summary submission

### 18.3 Round Summary Display
- [ ] Create RoundSummary component
- [ ] Show summary text
- [ ] Show outcomes
- [ ] Show round statistics
- [ ] Test display

### 18.4 New Round Notification
- [ ] Show notification when new round starts
- [ ] Reset UI to proposal phase
- [ ] Test round transition

---

## Phase 19: Frontend - Game History
**Estimated Time:** 3-4 days

### 19.1 Action History List
- [ ] Create GameHistory component
- [ ] Fetch action history
- [ ] Display actions in chronological order
- [ ] Show collapsed view by default
- [ ] Test history display

### 19.2 Action Details Expansion
- [ ] Make actions expandable
- [ ] Show full arguments when expanded
- [ ] Show votes summary
- [ ] Show result and narration
- [ ] Test expansion

### 19.3 Round History
- [ ] Create RoundHistory component
- [ ] Group actions by round
- [ ] Show round summaries
- [ ] Show round statistics
- [ ] Test round grouping

### 19.4 Search/Filter (Optional)
- [*] Add search functionality
- [*] Filter by round
- [*] Filter by player
- [*] Test filtering

---

## Phase 20: Frontend - Notifications & UX
**Estimated Time:** 2-3 days

### 20.1 Notification UI
- [ ] Create notification banner component
- [ ] Show success/error/info messages
- [ ] Auto-dismiss after timeout
- [ ] Test notifications

### 20.2 Loading States
- [ ] Add loading spinners
- [ ] Add skeleton screens
- [ ] Handle loading for all async operations
- [ ] Test loading states

### 20.3 Error Handling
- [ ] Create error boundary
- [ ] Display user-friendly error messages
- [ ] Provide retry options
- [ ] Test error handling

### 20.4 Confirmation Dialogs
- [ ] Create confirmation modal
- [ ] Use for destructive actions
- [ ] Test confirmations

---

## Phase 21: Integration & Testing
**Estimated Time:** 5-7 days

### 21.1 End-to-End Testing Setup
- [ ] Install Playwright or Cypress
- [ ] Configure test environment
- [ ] Set up test database
- [ ] Create test utilities

### 21.2 Authentication E2E Tests
- [ ] Test user registration flow
- [ ] Test user login flow
- [ ] Test logout flow
- [ ] Test protected routes

### 21.3 Game Flow E2E Tests
- [ ] Test creating a game
- [ ] Test joining a game
- [ ] Test starting a game
- [ ] Test complete action cycle
- [ ] Test round completion
- [ ] Test round summary
- [ ] Test multiple rounds

### 21.4 Unit Tests (Backend)
- [ ] Test token drawing algorithm
- [ ] Test vote calculation
- [ ] Test phase transitions
- [ ] Test round completion logic
- [ ] Test validation schemas

### 21.5 Unit Tests (Frontend)
- [ ] Test form validations
- [ ] Test utility functions
- [ ] Test custom hooks
- [ ] Test critical components

### 21.6 Integration Tests
- [ ] Test API endpoints
- [ ] Test database operations
- [ ] Test email sending
- [ ] Test timeout workers

---

## Phase 22: Polish & Optimization
**Estimated Time:** 3-5 days

### 22.1 Performance Optimization
- [ ] Add database indexes
- [ ] Optimize database queries
- [ ] Add Redis caching (optional)
- [ ] Optimize bundle size
- [ ] Test performance

### 22.2 Accessibility
- [ ] Add ARIA labels
- [ ] Test keyboard navigation
- [ ] Test screen reader compatibility
- [ ] Ensure color contrast
- [ ] Test with accessibility tools

### 22.3 Mobile Responsiveness
- [ ] Test on mobile devices
- [ ] Adjust layouts for small screens
- [ ] Test touch interactions
- [ ] Optimize for mobile performance

### 22.4 UI/UX Polish
- [ ] Refine animations
- [ ] Improve transitions
- [ ] Ensure consistent styling
- [ ] Add helpful tooltips
- [ ] Test user flows

---

## Phase 23: Documentation
**Estimated Time:** 2-3 days

### 23.1 User Documentation
- [ ] Write user guide
- [ ] Create tutorial/walkthrough
- [ ] Document game rules
- [ ] Add FAQ section

### 23.2 Developer Documentation
- [ ] Document API endpoints
- [ ] Document database schema
- [ ] Document environment setup
- [ ] Create contribution guide
- [ ] Document deployment process

### 23.3 Code Documentation
- [ ] Add JSDoc comments to functions
- [ ] Document complex algorithms
- [ ] Add README files to key directories
- [ ] Create architecture diagram

---

## Phase 24: Deployment Preparation
**Estimated Time:** 3-4 days

### 24.1 Environment Configuration
- [ ] Create production environment variables
- [ ] Configure production database
- [ ] Set up production email service
- [ ] Configure security settings

### 24.2 Build & Deploy Scripts
- [ ] Create production build scripts
- [ ] Test production builds locally
- [ ] Create deployment workflow
- [ ] Set up CI/CD pipeline (GitHub Actions)

### 24.3 Hosting Setup
- [ ] Choose hosting platform (Railway, Render, AWS, etc.)
- [ ] Set up production database instance
- [ ] Set up Redis instance (if using)
- [ ] Configure DNS and domain

### 24.4 Deployment
- [ ] Deploy backend to production
- [ ] Deploy frontend to production
- [ ] Run production migrations
- [ ] Test production deployment
- [ ] Set up monitoring (Sentry, LogTail)

---

## Phase 25: Launch & Monitoring
**Estimated Time:** 1-2 days

### 25.1 Pre-Launch Checklist
- [ ] Test all critical user flows
- [ ] Verify email delivery
- [ ] Check error tracking
- [ ] Verify database backups
- [ ] Load test application

### 25.2 Soft Launch
- [ ] Deploy to production
- [ ] Invite beta testers
- [ ] Monitor for errors
- [ ] Collect feedback
- [ ] Fix critical bugs

### 25.3 Monitoring Setup
- [ ] Set up error alerts
- [ ] Set up performance monitoring
- [ ] Set up uptime monitoring
- [ ] Configure logging
- [ ] Create monitoring dashboard

---

## Phase 26: Post-Launch
**Estimated Time:** Ongoing

### 26.1 Bug Fixes
- [ ] Address reported bugs
- [ ] Fix edge cases
- [ ] Improve error messages
- [ ] Optimize performance issues

### 26.2 User Feedback
- [ ] Collect user feedback
- [ ] Prioritize feature requests
- [ ] Update documentation based on feedback
- [ ] Plan future iterations

---

## Optional/Future Features (v2+)

### Initiative Auction System
- [*] Design initiative auction UI
- [*] Implement initiative point tracking
- [*] Create bidding interface
- [*] Integrate with action proposal

### Secret Actions
- [*] Design secret action mechanism
- [*] Implement secret action storage
- [*] Create trigger detection
- [*] Build revelation interface

### Real-time Features
- [*] Integrate WebSocket
- [*] Add live presence indicators
- [*] Real-time vote updates
- [*] Live typing indicators

### Rich Content
- [*] Add rich text editor for narration
- [*] Support image uploads
- [*] Add emoji support
- [*] Support Markdown formatting

### Advanced Features
- [*] AI-assisted suggestions
- [*] Game templates
- [*] Campaign management
- [*] Spectator mode
- [*] Game replay/analysis

---

## Estimated Timeline Summary

| Phase | Duration | Type |
|-------|----------|------|
| 0. Project Setup | 3-5 days | Infrastructure |
| 1. Database Schema | 3-4 days | Backend |
| 2. Auth & Users | 4-5 days | Backend |
| 3. Game Management | 5-6 days | Backend |
| 4. Round Management | 3-4 days | Backend |
| 5. Action System | 6-7 days | Backend |
| 6. Timeouts | 3-4 days | Backend |
| 7. Notifications | 3-4 days | Backend |
| 8. Security | 2-3 days | Backend |
| **Backend Subtotal** | **32-42 days** | |
| 9. Frontend Setup | 2-3 days | Frontend |
| 10. Auth UI | 3-4 days | Frontend |
| 11. Game Management UI | 4-5 days | Frontend |
| 12. Game View | 3-4 days | Frontend |
| 13. Action Proposal | 3-4 days | Frontend |
| 14. Argumentation | 3-4 days | Frontend |
| 15. Voting | 3-4 days | Frontend |
| 16. Token Drawing | 3-4 days | Frontend |
| 17. Narration | 2-3 days | Frontend |
| 18. Round Summary | 3-4 days | Frontend |
| 19. Game History | 3-4 days | Frontend |
| 20. Notifications & UX | 2-3 days | Frontend |
| **Frontend Subtotal** | **34-45 days** | |
| 21. Integration & Testing | 5-7 days | Testing |
| 22. Polish | 3-5 days | QA |
| 23. Documentation | 2-3 days | Docs |
| 24. Deployment Prep | 3-4 days | DevOps |
| 25. Launch | 1-2 days | Launch |
| **Total** | **80-108 days** | **~12-16 weeks** |

**Notes:**
- Estimate assumes 1-2 developers working full-time
- Some phases can be parallelized (frontend/backend)
- Buffer time recommended for unexpected issues
- Post-launch maintenance is ongoing

---

## Success Criteria

### MVP Launch Requirements
- [ ] Users can register and log in
- [ ] Users can create and join games
- [ ] Complete action resolution cycle works
- [ ] Rounds work correctly (one action per player)
- [ ] Round summaries can be written
- [ ] Game history is viewable
- [ ] Email notifications work
- [ ] Mobile responsive
- [ ] No critical bugs
- [ ] Performance acceptable (<2s page loads)

### Quality Gates
- [ ] All critical E2E tests passing
- [ ] >80% unit test coverage on core logic
- [ ] Security audit complete
- [ ] Accessibility audit complete
- [ ] Performance testing complete
- [ ] Documentation complete

---

## Risk Mitigation

### High-Risk Items
1. **Token randomness fairness** - Implement early, test thoroughly
2. **Async coordination** - Plan timeout handling carefully
3. **State synchronization** - Use polling initially, WebSocket later
4. **Database performance** - Add indexes proactively
5. **Email deliverability** - Test with multiple providers

### Recommended Approach
- Start with Phase 0-1 (setup) completely
- Build backend first (Phases 2-8)
- Build frontend second (Phases 9-20)
- Leave time for integration testing
- Plan for 20% buffer time

---

## Development Tips

### Best Practices
- Commit frequently with clear messages
- Write tests as you go
- Document as you build
- Review code regularly
- Deploy early and often (to staging)

### When Stuck
- Check the PRD, ERD, and Technical Spec
- Review similar implementations
- Ask for help early
- Take breaks
- Simplify the approach

---

**Good luck with your build! 🚀**
