# Deployment Guide

This guide covers deploying Mosaic Matrix Game to production environments.

## Table of Contents

- [Prerequisites](#prerequisites)
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

Railway provides easy deployment with built-in PostgreSQL.

#### Setup Steps

1. **Create a new project** on [railway.app](https://railway.app)

2. **Add PostgreSQL database**
   - Click "New" → "Database" → "PostgreSQL"
   - Railway automatically sets `DATABASE_URL`

3. **Deploy the backend**
   - Click "New" → "GitHub Repo"
   - Select your repository
   - Set root directory to `server`
   - Add environment variables (Railway dashboard → Variables)

4. **Deploy the frontend**
   - Add another service from the same repo
   - Set root directory to `client`
   - Set build command: `npm run build`
   - Set start command: `npm run preview` (or use static hosting)

5. **Run migrations**
   ```bash
   railway run npx prisma migrate deploy
   ```

6. **Set up custom domain** (optional)
   - Go to service settings → Domains
   - Add your custom domain

#### Railway Environment Variables

```
NODE_ENV=production
JWT_SECRET=your-generated-secret
APP_URL=https://your-app.railway.app
EMAIL_HOST=smtp.sendgrid.net
EMAIL_USER=apikey
EMAIL_PASS=your-sendgrid-key
EMAIL_FROM=noreply@yourdomain.com
```

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
