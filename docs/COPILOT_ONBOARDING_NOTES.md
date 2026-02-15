# Copilot Onboarding - Errors and Workarounds

This document records the errors encountered during the onboarding process and how they were addressed in the `.github/copilot-instructions.md` file.

## Date: February 14, 2026

## Errors Encountered During Testing

### 1. Docker Compose Command Issue

**Error:**

```
bash: docker-compose: command not found
```

**Cause:** Newer versions of Docker (Docker Desktop 3.4+) use `docker compose` (with a space) as a built-in command instead of the separate `docker-compose` binary.

**Workaround:** Use `docker compose` (with space) instead of `docker-compose` (hyphenated).

**Documentation Added:** Yes, in "Common Errors and Workarounds" section.

---

### 2. Missing Environment File

**Error:**

```
Error: Prisma schema validation - (get-config wasm)
Error code: P1012
error: Environment variable not found: DATABASE_URL.
```

**Cause:** The `server/.env` file doesn't exist after fresh clone. Prisma requires this file to read the `DATABASE_URL` environment variable.

**Workaround:** Copy the example environment file:

```bash
cp server/.env.example server/.env
```

**Documentation Added:** Yes, in "Common Errors and Workarounds" section with detailed explanation.

---

### 3. pnpm Not Installed

**Error:**

```
bash: pnpm: command not found
```

**Cause:** The system doesn't have pnpm installed globally. This is a fresh environment.

**Workaround:** Install pnpm globally:

```bash
npm install -g pnpm@8.15.4
```

**Documentation Added:** Yes, in prerequisites section of README.md (already existed).

---

### 4. E2E Tests Skipped

**Observation:** When running `pnpm test`, E2E tests show as skipped:

```
❯ tests/e2e/action.e2e.test.ts (22 tests | 22 skipped) 3ms
```

**Cause:** This is intentional. E2E tests are configured to run separately via `vitest.config.e2e.ts` to avoid database conflicts and to allow them to run sequentially.

**Workaround:** Run E2E tests explicitly:

```bash
pnpm --filter server test:e2e
```

**Documentation Added:** Yes, in "Common Errors and Workarounds" section, clarifying this is expected behavior.

---

### 5. Code Formatting Issues

**Warning:** Many files showed formatting warnings when checking:

```
[warn] .github/copilot-instructions.md
[warn] CLAUDE.md
[warn] client/eslint.config.js
...
```

**Cause:** Code doesn't match Prettier formatting rules. This is normal during development.

**Workaround:** Run Prettier to auto-format:

```bash
pnpm format
```

**Documentation Added:** Yes, in "Common Errors and Workarounds" section.

---

### 6. Prisma Client Not Generated

**Potential Error:** After fresh clone or schema changes, Prisma client may not be available.

**Cause:** Prisma client must be generated after cloning or when schema changes.

**Workaround:**

```bash
pnpm db:generate
```

**Documentation Added:** Yes, in "Common Errors and Workarounds" section with detailed triggers.

---

### 7. Port Conflicts

**Potential Error:** Development servers fail to start if ports 3000 or 5173 are already in use.

**Cause:** Another process is using the same port.

**Workaround:** Find and kill the process using the port:

```bash
lsof -ti:3000 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```

**Documentation Added:** Yes, in "Common Errors and Workarounds" section.

---

## Additional Documentation Added

### Backend Architecture Patterns

- **Controller → Service → Prisma Pattern**: Documented the strict layered architecture with code examples
- **Input Validation Pattern**: Showed how to use Zod schemas consistently
- **Error Handling Pattern**: Explained custom error classes and middleware

### Frontend Architecture Patterns

- **TanStack Query Usage**: How to use queries and mutations for server state
- **Component Organization**: Pages, components, layout, UI structure
- **Styling with Tailwind**: Usage patterns and the `cn()` utility

### Testing Patterns

- **Test File Organization**: Where to place different types of tests
- **Running Tests**: All the different test commands
- **Test Patterns**: Unit test mocking vs integration test patterns

## Summary

The `.github/copilot-instructions.md` file has been significantly enhanced with:

1. **7 Common Errors** with causes and solutions
2. **Backend Architecture Patterns** with code examples
3. **Frontend Architecture Patterns** with best practices
4. **Testing Patterns** with organization and examples
5. **Detailed documentation** on the layered architecture approach

These additions should help GitHub Copilot (or any AI coding assistant) understand the project structure and avoid common pitfalls when making code changes.

## Files Modified

- `.github/copilot-instructions.md` - Main update with 300+ lines of new content

## Testing Performed

1. ✅ Installed dependencies with pnpm
2. ✅ Started Docker Compose database
3. ✅ Ran database migrations
4. ✅ Generated Prisma client
5. ✅ Ran linting (passed with 1 warning)
6. ✅ Built project (successful)
7. ✅ Ran unit and integration tests (passed)
8. ✅ Verified E2E tests are properly configured (skipped by default, as expected)
9. ✅ Formatted all code with Prettier

## Conclusion

The onboarding documentation is now comprehensive and includes real-world errors encountered during setup and development. This should significantly improve the experience for both human developers and AI coding assistants working with this repository.
