# Deployment Guide

This guide covers deploying Mosaic Matrix Game to production environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [CI/CD Pipeline](#cicd-pipeline)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Email Service Setup](#email-service-setup)
- [Deployment Platforms](#deployment-platforms)
  - [Railway](#railway)
  - [Render](#render)
  - [Fly.io](#flyio)
  - [Manual/VPS Deployment](#manualvps-deployment)
- [Post-Deployment Checklist](#post-deployment-checklist)
- [Monitoring & Maintenance](#monitoring--maintenance)

---

## Prerequisites

Before deploying, ensure you have:

1. A PostgreSQL database (most platforms provide this)
2. An email service account (SendGrid recommended)
3. A domain name (optional but recommended)
4. Git repository with the latest code

---

## CI/CD Pipeline

The project uses GitHub Actions for continuous integration and deployment.

### Continuous Integration (`.github/workflows/ci.yml`)

Runs on every pull request and push to `main`:

| Job | Description |
|-----|-------------|
| **Lint** | Runs ESLint on all code |
| **Test Server** | Runs backend tests with PostgreSQL |
| **Test Client** | Runs frontend tests |
| **Build** | Builds both server and client for production |

### Continuous Deployment (`.github/workflows/deploy.yml`)

Deploys automatically when you create a version tag:

```bash
# Create and push a release tag
git tag v1.0.0
git push origin v1.0.0
```

This triggers:
1. Deploy server to Railway
2. Deploy client to Railway
3. Run database migrations
4. Create GitHub release with notes

### Required GitHub Secrets

Set these in your repository settings (Settings → Secrets → Actions):

| Secret | Description |
|--------|-------------|
| `RAILWAY_TOKEN` | Railway API token (get from Railway dashboard → Account → Tokens) |
| `DATABASE_URL` | Production database URL (for migrations) |

### Required GitHub Variables

Set these in Settings → Secrets → Variables:

| Variable | Description |
|----------|-------------|
| `API_URL` | Production API URL (e.g., `https://api.mosaicgame.com`) |

### Creating a Release

```bash
# 1. Ensure all tests pass locally
pnpm test

# 2. Update version in package.json (optional)

# 3. Commit any changes
git add . && git commit -m "Prepare release v1.0.0"

# 4. Create annotated tag
git tag -a v1.0.0 -m "Release v1.0.0"

# 5. Push tag to trigger deployment
git push origin v1.0.0
```

---

## Environment Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Must be `production` | `production` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Secret for signing tokens (min 32 chars) | Generate with `openssl rand -base64 32` |
| `APP_URL` | Frontend URL (no trailing slash) | `https://mosaicgame.com` |
| `EMAIL_HOST` | SMTP server hostname | `smtp.sendgrid.net` |
| `EMAIL_USER` | SMTP username | `apikey` |
| `EMAIL_PASS` | SMTP password/API key | Your API key |
| `EMAIL_FROM` | Sender email address | `noreply@mosaicgame.com` |

### Optional Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port (usually set by platform) |
| `JWT_EXPIRY` | `7d` | Token expiration time |
| `BCRYPT_ROUNDS` | `12` | Password hashing rounds |
| `EMAIL_ENABLED` | `true` | Enable/disable emails |
| `ENABLE_TIMEOUT_WORKER` | `true` | Enable automatic phase timeouts |
| `TIMEOUT_CHECK_INTERVAL_MS` | `60000` | Timeout check frequency |

### Generating a Secure JWT Secret

```bash
# Linux/macOS
openssl rand -base64 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Database Setup

### PostgreSQL Requirements

- PostgreSQL 14 or higher recommended
- SSL connection required for production
- Minimum 1GB storage for small deployments

### Running Migrations

After deploying, run migrations to set up the database schema:

```bash
# If using the platform's CLI/shell
npx prisma migrate deploy

# Or from your local machine with DATABASE_URL set
DATABASE_URL="postgresql://..." npx prisma migrate deploy
```

### Database Connection String Format

```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public&sslmode=require
```

**Important:** Always use `sslmode=require` in production.

---

## Email Service Setup

### SendGrid (Recommended)

1. Create account at [sendgrid.com](https://sendgrid.com)
2. Verify your sender domain or email
3. Create an API key with "Mail Send" permissions
4. Configure environment variables:
   ```
   EMAIL_HOST=smtp.sendgrid.net
   EMAIL_PORT=587
   EMAIL_USER=apikey
   EMAIL_PASS=SG.your-api-key-here
   EMAIL_FROM=noreply@yourdomain.com
   ```

### AWS SES

1. Set up SES in your AWS account
2. Verify your sender domain
3. Create SMTP credentials in SES console
4. Configure environment variables:
   ```
   EMAIL_HOST=email-smtp.us-east-1.amazonaws.com
   EMAIL_PORT=587
   EMAIL_USER=your-smtp-username
   EMAIL_PASS=your-smtp-password
   EMAIL_FROM=noreply@yourdomain.com
   ```

### Mailgun

1. Create account at [mailgun.com](https://mailgun.com)
2. Add and verify your domain
3. Get SMTP credentials from domain settings
4. Configure environment variables:
   ```
   EMAIL_HOST=smtp.mailgun.org
   EMAIL_PORT=587
   EMAIL_USER=postmaster@yourdomain.com
   EMAIL_PASS=your-mailgun-password
   EMAIL_FROM=noreply@yourdomain.com
   ```

---

## Deployment Platforms

### Railway

Railway provides easy deployment with built-in PostgreSQL. This project includes Railway configuration files (`railway.toml`) for both server and client.

#### Prerequisites

1. A [Railway](https://railway.app) account
2. A GitHub repository with your code
3. Railway CLI installed (optional, for local deployment):
   ```bash
   npm install -g @railway/cli
   railway login
   ```

#### Project Structure

The project is configured with Railway config files:
- `server/railway.toml` - Backend configuration (Nixpacks build, auto-migrations)
- `client/railway.toml` - Frontend configuration (static file serving)

#### Setup Steps

1. **Create a new project** on [railway.app](https://railway.app)
   - Click "New Project" → "Empty Project"
   - Note your project ID from the URL or settings (needed for CI/CD)

2. **Add PostgreSQL database**
   - Click "New" → "Database" → "PostgreSQL"
   - Railway automatically sets `DATABASE_URL` for linked services
   - Make note of the connection string for GitHub secrets

3. **Deploy the backend (API service)**
   - Click "New" → "GitHub Repo"
   - Select your repository
   - **Important:** Set root directory to `server`
   - Railway will auto-detect `railway.toml` configuration
   - The service will automatically:
     - Build with Nixpacks
     - Generate Prisma client
     - Run migrations on startup
     - Expose health check at `/health`

4. **Configure backend environment variables**
   - Go to the server service → Variables tab
   - Add the following (Railway auto-injects `DATABASE_URL` and `PORT`):
   ```
   NODE_ENV=production
   JWT_SECRET=<generate with: openssl rand -base64 32>
   APP_URL=https://your-client-domain.railway.app
   EMAIL_HOST=smtp.sendgrid.net
   EMAIL_USER=apikey
   EMAIL_PASS=your-sendgrid-api-key
   EMAIL_FROM=noreply@yourdomain.com
   ```

5. **Deploy the frontend (Client service)**
   - Click "New" → "GitHub Repo" (same repo)
   - **Important:** Set root directory to `client`
   - Railway will auto-detect `railway.toml` configuration
   - The client uses `serve` to host static files

6. **Configure frontend environment variables**
   - Add the following build-time variable:
   ```
   VITE_API_URL=https://your-api-domain.railway.app
   ```

7. **Link the database to services**
   - Click the PostgreSQL service
   - Go to "Connect" → connect to your server service
   - This injects `DATABASE_URL` automatically

8. **Set up custom domains** (recommended)
   - Server: Settings → Networking → Generate Domain (or add custom)
   - Client: Settings → Networking → Generate Domain (or add custom)
   - Update `APP_URL` and `VITE_API_URL` to match

#### GitHub Actions CI/CD Setup

The project includes automated deployment via GitHub Actions. Set up:

1. **Get Railway Token**
   - Railway Dashboard → Account Settings → Tokens
   - Create a new token with project access

2. **Configure GitHub Secrets** (Settings → Secrets → Actions)
   | Secret | Description |
   |--------|-------------|
   | `RAILWAY_TOKEN` | Your Railway API token |
   | `DATABASE_URL` | Production database URL (for migration verification) |

3. **Configure GitHub Variables** (Settings → Secrets → Variables)
   | Variable | Description |
   |----------|-------------|
   | `API_URL` | Production API URL (e.g., `https://api.mosaicgame.com`) |

4. **Deploy with tags**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

#### Railway Configuration Files

**Server (`server/railway.toml`):**
```toml
[build]
builder = "nixpacks"
buildCommand = "npm install && npx prisma generate && npm run build"

[deploy]
startCommand = "npx prisma migrate deploy && node dist/index.js"
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 10
```

**Client (`client/railway.toml`):**
```toml
[build]
builder = "nixpacks"
buildCommand = "npm install && npm run build"

[deploy]
startCommand = "npx serve -s dist -l $PORT"
healthcheckPath = "/"
healthcheckTimeout = 300
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 10
```

#### Troubleshooting Railway

**Build failures:**
- Check Railway build logs for specific errors
- Ensure `railway.toml` is in the correct directory (server/ or client/)
- Verify the root directory is set correctly in Railway service settings

**Database connection issues:**
- Verify PostgreSQL service is linked to your server
- Check that `DATABASE_URL` is in the Variables tab
- Ensure SSL is enabled: `?sslmode=require` in connection string

**Migrations not running:**
- Migrations run on every deploy via `startCommand`
- Check deploy logs for Prisma migration output
- Manually run: `railway run --service=mosaic-api npx prisma migrate deploy`

---

### Render

Render provides simple deployment with free tier options.

#### Setup Steps

1. **Create PostgreSQL database**
   - Dashboard → New → PostgreSQL
   - Copy the Internal Database URL

2. **Create Web Service for backend**
   - New → Web Service
   - Connect your GitHub repo
   - Root directory: `server`
   - Build command: `npm install && npx prisma generate && npm run build`
   - Start command: `npm start`

3. **Add environment variables**
   - Use the Environment tab in your service settings

4. **Create Static Site for frontend**
   - New → Static Site
   - Root directory: `client`
   - Build command: `npm install && npm run build`
   - Publish directory: `dist`

5. **Run migrations**
   - Use Render's Shell feature or add to build command:
   ```
   npm install && npx prisma generate && npx prisma migrate deploy && npm run build
   ```

---

### Fly.io

Fly.io offers edge deployment with excellent performance.

#### Setup Steps

1. **Install Fly CLI**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Create fly.toml** in `server/`:
   ```toml
   app = "mosaic-game-api"
   primary_region = "ord"

   [build]
     builder = "heroku/buildpacks:20"

   [env]
     NODE_ENV = "production"
     PORT = "8080"

   [http_service]
     internal_port = 8080
     force_https = true
     auto_stop_machines = true
     auto_start_machines = true

   [[services]]
     protocol = "tcp"
     internal_port = 8080
     [services.concurrency]
       type = "connections"
       hard_limit = 25
       soft_limit = 20
   ```

3. **Create PostgreSQL database**
   ```bash
   fly postgres create --name mosaic-game-db
   fly postgres attach mosaic-game-db
   ```

4. **Set secrets**
   ```bash
   fly secrets set JWT_SECRET="your-secret"
   fly secrets set EMAIL_HOST="smtp.sendgrid.net"
   fly secrets set EMAIL_USER="apikey"
   fly secrets set EMAIL_PASS="your-key"
   fly secrets set EMAIL_FROM="noreply@yourdomain.com"
   fly secrets set APP_URL="https://your-app.fly.dev"
   ```

5. **Deploy**
   ```bash
   fly deploy
   ```

---

### Manual/VPS Deployment

For deployment on a VPS (DigitalOcean, Linode, AWS EC2, etc.):

#### Prerequisites

- Ubuntu 22.04 or similar
- Node.js 20.x
- PostgreSQL 14+
- Nginx (for reverse proxy)
- PM2 (for process management)

#### Setup Steps

1. **Install dependencies**
   ```bash
   # Node.js
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs

   # PostgreSQL
   sudo apt-get install -y postgresql postgresql-contrib

   # Nginx
   sudo apt-get install -y nginx

   # PM2
   sudo npm install -g pm2
   ```

2. **Create PostgreSQL database**
   ```bash
   sudo -u postgres psql
   CREATE USER mosaic WITH PASSWORD 'secure-password';
   CREATE DATABASE mosaic_game OWNER mosaic;
   \q
   ```

3. **Clone and build**
   ```bash
   git clone https://github.com/your-repo/mosaic-game.git
   cd mosaic-game/server
   npm install
   npx prisma generate
   npx prisma migrate deploy
   npm run build
   ```

4. **Create .env file**
   ```bash
   cp .env.production.example .env
   # Edit .env with your values
   ```

5. **Start with PM2**
   ```bash
   pm2 start dist/index.js --name mosaic-api
   pm2 save
   pm2 startup
   ```

6. **Configure Nginx**
   ```nginx
   server {
       listen 80;
       server_name api.yourdomain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

7. **Set up SSL with Certbot**
   ```bash
   sudo apt-get install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d api.yourdomain.com
   ```

---

## Post-Deployment Checklist

After deploying, verify the following:

### Functionality
- [ ] Health check endpoint responds: `GET /health`
- [ ] User registration works
- [ ] User login works
- [ ] Game creation works
- [ ] Email notifications are received

### Security
- [ ] HTTPS is enforced
- [ ] CORS is configured correctly
- [ ] Rate limiting is active
- [ ] JWT secret is unique and secure

### Database
- [ ] Migrations ran successfully
- [ ] Database has SSL enabled
- [ ] Backups are configured

### Monitoring
- [ ] Error logging is working
- [ ] Health checks are configured
- [ ] Alerts are set up (if applicable)

---

## Monitoring & Maintenance

### Health Check

The API exposes a health endpoint:

```bash
curl https://your-api.com/health
# Response: {"status":"ok","timestamp":"2024-01-01T00:00:00.000Z"}
```

### Log Monitoring

Configure your platform's logging or use a service like:
- [Logtail](https://logtail.com)
- [Papertrail](https://papertrailapp.com)
- [Datadog](https://datadoghq.com)

### Error Tracking

Consider adding Sentry for error tracking:

1. Create account at [sentry.io](https://sentry.io)
2. Add `SENTRY_DSN` environment variable
3. Install Sentry SDK (see Sentry docs)

### Database Backups

Most managed databases include automatic backups. Verify:
- Daily backups are enabled
- Point-in-time recovery is available
- Backup retention meets your needs

### Scaling

When you need to scale:

1. **Vertical scaling**: Increase server resources
2. **Horizontal scaling**: Add more instances behind a load balancer
3. **Database scaling**: Use connection pooling (PgBouncer) or read replicas

---

## Troubleshooting

### Common Issues

**Database connection failed**
- Check `DATABASE_URL` format
- Verify SSL is enabled (`sslmode=require`)
- Check firewall/network rules

**Emails not sending**
- Verify SMTP credentials
- Check sender domain verification
- Review email service logs

**CORS errors**
- Verify `APP_URL` matches your frontend URL exactly
- Check for trailing slashes

**JWT errors**
- Ensure `JWT_SECRET` is set and consistent across restarts
- Check token expiration settings

### Getting Help

- Check the [GitHub Issues](https://github.com/your-repo/issues)
- Review application logs
- Verify all environment variables are set correctly
