# Linux Server Setup Guide
## URL Monitoring Service - On-Campus Deployment

**Version:** 2.0  
**Date:** 2024  
**Target Platform:** Linux Server (Ubuntu/Debian/CentOS)  
**Deployment Type:** On-Campus Self-Hosted with Local SQLite Database

---

## Table of Contents

1. [Server Requirements](#server-requirements)
2. [Pre-Installation Checklist](#pre-installation-checklist)
3. [Operating System Setup](#operating-system-setup)
4. [Node.js Installation](#nodejs-installation)
5. [Database Setup (Local SQLite)](#database-setup-local-sqlite)
6. [Application Deployment](#application-deployment)
7. [Process Management](#process-management)
8. [Web Server Configuration (Nginx)](#web-server-configuration-nginx)
9. [SSL Certificate Setup](#ssl-certificate-setup)
10. [Cron Job Configuration](#cron-job-configuration)
11. [Firewall Configuration](#firewall-configuration)
12. [Security Hardening](#security-hardening)
13. [Monitoring & Maintenance](#monitoring--maintenance)
14. [Troubleshooting](#troubleshooting)
15. [Backup & Recovery](#backup--recovery)

---

## 1. Server Requirements

### 1.1 Minimum Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **CPU** | 2 cores | 4 cores |
| **RAM** | 2 GB | 4 GB |
| **Storage** | 20 GB SSD | 50 GB SSD |
| **Network** | 100 Mbps | 1 Gbps |

### 1.2 Software Requirements

- **Operating System**: Ubuntu 20.04 LTS / 22.04 LTS, Debian 11+, or CentOS 8+
- **Node.js**: Version 18.x or 20.x LTS
- **npm**: Version 9.x or higher
- **SQLite**: Version 3.31+ (usually pre-installed)
- **Nginx**: Version 1.18+ (for reverse proxy)
- **PM2**: Latest version (for process management)
- **Certbot**: For SSL certificates (Let's Encrypt)

### 1.3 Network Requirements

- **Inbound Ports**:
  - `80` (HTTP) - for Let's Encrypt and redirects
  - `443` (HTTPS) - for application access
  - `22` (SSH) - for server management
- **Outbound Access**:
  - HTTP/HTTPS access to monitored URLs
  - DNS resolution capability
  - NTP for time synchronization

### 1.4 Campus-Specific Considerations

- **Network Access**: Ensure server can reach both internal campus services and external URLs
- **Firewall Rules**: Coordinate with IT department for port openings
- **DNS**: Configure internal DNS if needed for service discovery
- **Proxy Settings**: If campus uses proxy, configure Node.js proxy settings
- **Time Sync**: Ensure NTP is configured for accurate timestamps
- **Timezone**: Application uses Central Time (America/Chicago) for scheduled checks

---

## 2. Pre-Installation Checklist

Before starting the installation, ensure you have:

- [ ] Root or sudo access to the Linux server
- [ ] SSH access configured
- [ ] Server hostname configured
- [ ] Static IP address assigned (recommended)
- [ ] Domain name or subdomain configured (e.g., `monitor.yourcampus.edu`)
- [ ] DNS A record pointing to server IP
- [ ] Firewall ports opened (80, 443, 22)
- [ ] Backup strategy planned
- [ ] Monitoring solution selected (optional)

---

## 3. Operating System Setup

### 3.1 Initial Server Configuration

#### Update System Packages

```bash
# Ubuntu/Debian
sudo apt update
sudo apt upgrade -y

# CentOS/RHEL
sudo yum update -y
# or for newer versions
sudo dnf update -y
```

#### Install Essential Tools

```bash
# Ubuntu/Debian
sudo apt install -y curl wget git build-essential software-properties-common

# CentOS/RHEL
sudo yum install -y curl wget git gcc gcc-c++ make
```

#### Configure Hostname (Optional)

```bash
# Set hostname
sudo hostnamectl set-hostname url-monitor-server

# Verify
hostnamectl
```

#### Configure Timezone (Central Time for Beaumont, TX)

```bash
# Set timezone to Central Time (America/Chicago)
sudo timedatectl set-timezone America/Chicago

# Verify
timedatectl
```

#### Install and Configure NTP

```bash
# Ubuntu/Debian
sudo apt install -y ntp ntpdate
sudo systemctl enable ntp
sudo systemctl start ntp

# CentOS/RHEL
sudo yum install -y ntp
sudo systemctl enable ntpd
sudo systemctl start ntpd

# Sync time
sudo ntpdate -q pool.ntp.org
```

### 3.2 Create Application User

```bash
# Create dedicated user for the application
sudo useradd -m -s /bin/bash urlmonitor

# Add user to necessary groups
sudo usermod -aG sudo urlmonitor

# Set password (or use SSH keys)
sudo passwd urlmonitor

# Switch to application user
su - urlmonitor
```

---

## 4. Node.js Installation

### 4.1 Install Node.js Using NodeSource Repository (Recommended)

```bash
# Ubuntu/Debian - Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# CentOS/RHEL - Node.js 20.x LTS
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs
```

### 4.2 Verify Installation

```bash
# Check Node.js version (should be 20.x)
node --version

# Check npm version (should be 10.x)
npm --version

# Check installed packages
npm list -g --depth=0
```

### 4.3 Install Global Packages

```bash
# Install PM2 globally for process management
sudo npm install -g pm2

# Install tsx globally for TypeScript execution
sudo npm install -g tsx

# Verify PM2 installation
pm2 --version
```

### 4.4 Configure npm (Optional)

```bash
# Set npm prefix (if needed)
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'

# Add to PATH (add to ~/.bashrc or ~/.zshrc)
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

---

## 5. Database Setup (Local SQLite)

### 5.1 Install SQLite

SQLite is usually pre-installed, but verify:

```bash
# Check SQLite version
sqlite3 --version

# Ubuntu/Debian - Install if missing
sudo apt install -y sqlite3 libsqlite3-dev

# CentOS/RHEL - Install if missing
sudo yum install -y sqlite sqlite-devel
```

### 5.2 Create Database Directory

```bash
# Create application directory structure
sudo mkdir -p /opt/url-monitor
sudo mkdir -p /opt/url-monitor/database
sudo mkdir -p /opt/url-monitor/logs
sudo mkdir -p /opt/url-monitor/backups
sudo mkdir -p /opt/url-monitor/scripts

# Set ownership
sudo chown -R urlmonitor:urlmonitor /opt/url-monitor

# Set permissions
sudo chmod 755 /opt/url-monitor
sudo chmod 750 /opt/url-monitor/database
```

### 5.3 Database Schema Overview

The application uses the following database tables:

#### **urls** Table
- `id` (INTEGER PRIMARY KEY)
- `url` (TEXT NOT NULL UNIQUE) - The URL to monitor
- `name` (TEXT NOT NULL) - Human-readable service name
- `environment` (TEXT NOT NULL DEFAULT 'testing') - 'testing' or 'production'
- `created_at` (DATETIME DEFAULT CURRENT_TIMESTAMP)
- `updated_at` (DATETIME DEFAULT CURRENT_TIMESTAMP)

#### **url_status** Table
- `id` (INTEGER PRIMARY KEY)
- `url_id` (INTEGER NOT NULL) - Foreign key to urls table
- `status_code` (INTEGER) - HTTP status code (null if error)
- `status_text` (TEXT) - HTTP status text
- `response_time` (INTEGER) - Response time in milliseconds
- `is_up` (BOOLEAN NOT NULL) - Service availability status
- `checked_at` (DATETIME DEFAULT CURRENT_TIMESTAMP) - When check was performed
- `error_message` (TEXT) - Error message if check failed
- `location` (TEXT) - Redirect location header (for 301/302 redirects)
- Foreign key constraint: `url_id` references `urls(id)` ON DELETE CASCADE

**Indexes:**
- `idx_url_status_url_id` on `url_id`
- `idx_url_status_checked_at` on `checked_at`

#### **archived_url_status** Table
- `id` (INTEGER PRIMARY KEY)
- `url_id` (INTEGER NOT NULL)
- `status_code` (INTEGER)
- `status_text` (TEXT)
- `response_time` (INTEGER)
- `is_up` (BOOLEAN NOT NULL)
- `checked_at` (DATETIME NOT NULL)
- `error_message` (TEXT)
- `archived_at` (DATETIME DEFAULT CURRENT_TIMESTAMP) - When record was archived

**Note:** Archive table does NOT include `location` column (only active status records track redirects).

**Indexes:**
- `idx_archived_url_status_url_id` on `url_id`
- `idx_archived_url_status_checked_at` on `checked_at`

#### **admin_users** Table
- `id` (INTEGER PRIMARY KEY)
- `username` (TEXT NOT NULL UNIQUE)
- `password_hash` (TEXT NOT NULL) - Currently plain text (security issue)
- `created_at` (DATETIME DEFAULT CURRENT_TIMESTAMP)

### 5.4 Database File Configuration

The application will automatically create the SQLite database file, but you can pre-create it:

```bash
# Switch to application user
su - urlmonitor

# Create database file
cd /opt/url-monitor/database
touch url_monitor.db

# Set permissions
chmod 660 url_monitor.db
```

### 5.5 Database Backup Script

Create a backup script for regular database backups:

```bash
# Create backup script
sudo nano /opt/url-monitor/scripts/backup-db.sh
```

Add the following content:

```bash
#!/bin/bash
# Database Backup Script

BACKUP_DIR="/opt/url-monitor/backups"
DB_FILE="/opt/url-monitor/database/url_monitor.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/url_monitor_${TIMESTAMP}.db"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Create backup
cp "$DB_FILE" "$BACKUP_FILE"

# Compress backup
gzip "$BACKUP_FILE"

# Keep only last 30 days of backups
find "$BACKUP_DIR" -name "url_monitor_*.db.gz" -mtime +30 -delete

echo "Backup completed: ${BACKUP_FILE}.gz"
```

Make it executable:

```bash
chmod +x /opt/url-monitor/scripts/backup-db.sh
```

---

## 6. Application Deployment

### 6.1 Clone or Upload Application

#### Option A: Clone from Git Repository

```bash
# Switch to application user
su - urlmonitor

# Navigate to application directory
cd /opt/url-monitor

# Clone repository (replace with your repo URL)
git clone https://github.com/your-org/url-monitor.git app

# Or if you have the code locally, use SCP:
# scp -r /local/path/to/app urlmonitor@server:/opt/url-monitor/app
```

#### Option B: Upload via SCP

```bash
# From your local machine
scp -r /path/to/url-monitor urlmonitor@server:/opt/url-monitor/app
```

### 6.2 Modify Database Configuration for Local SQLite

The application currently uses Turso (cloud SQLite). We need to modify it to use local SQLite:

```bash
# Navigate to application directory
cd /opt/url-monitor/app

# Backup original file
cp lib/db.ts lib/db.ts.backup

# Edit lib/db.ts
nano lib/db.ts
```

Replace the database connection code (lines 1-13) with:

```typescript
import { createClient } from '@libsql/client';

// Support both local SQLite and remote Turso
const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;
const localDbPath = process.env.DATABASE_PATH || '/opt/url-monitor/database/url_monitor.db';

// Use local SQLite if DATABASE_PATH is set, otherwise use Turso
let dbConfig: { url: string; authToken?: string };

if (process.env.DATABASE_PATH) {
  // Local SQLite database
  dbConfig = {
    url: `file:${localDbPath}`,
    // No authToken needed for local SQLite
  };
} else if (tursoUrl && tursoAuthToken) {
  // Remote Turso database (fallback for cloud deployments)
  dbConfig = {
    url: tursoUrl,
    authToken: tursoAuthToken,
  };
} else {
  throw new Error('Either DATABASE_PATH or TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set');
}

export const db = createClient(dbConfig);

// Rest of the file (initDatabase function) remains the same...
```

**Important**: The `@libsql/client` package supports both remote Turso databases and local SQLite files. For local SQLite, use the `file:` protocol prefix in the URL.

#### Verify Database Configuration

After modifying `lib/db.ts`, verify the syntax is correct:

```bash
# Check TypeScript compilation
cd /opt/url-monitor/app
npx tsc --noEmit

# If there are errors, fix them before proceeding
```

### 6.3 Create Environment File

```bash
# Create .env file
cd /opt/url-monitor/app
nano .env
```

Add the following configuration:

```env
# Database Configuration (Local SQLite)
DATABASE_PATH=/opt/url-monitor/database/url_monitor.db

# Application Configuration
NODE_ENV=production
PORT=3000

# Cron Secret (generate a strong random string)
CRON_SECRET=your-secure-random-string-here-generate-with-openssl-rand-hex-32

# Application URL (for internal references)
NEXT_PUBLIC_APP_URL=https://monitor.yourcampus.edu
```

Generate a secure CRON_SECRET:

```bash
openssl rand -hex 32
```

**Note:** Do NOT set `TURSO_DATABASE_URL` or `TURSO_AUTH_TOKEN` when using local SQLite.

### 6.4 Install Dependencies

```bash
# Navigate to application directory
cd /opt/url-monitor/app

# Install all dependencies (including dev dependencies for building)
npm install
```

### 6.5 Build Application

```bash
# Build Next.js application
npm run build

# Verify build succeeded
ls -la .next
```

### 6.6 Initialize Database

```bash
# Initialize database schema
npm run init-db

# Verify database was created and tables exist
sqlite3 /opt/url-monitor/database/url_monitor.db ".tables"

# Expected output: admin_users archived_url_status urls url_status

# Verify schema
sqlite3 /opt/url-monitor/database/url_monitor.db ".schema urls"
sqlite3 /opt/url-monitor/database/url_monitor.db ".schema url_status"
```

### 6.7 Update next.config.js

Modify `next.config.js` to support local database:

```bash
cd /opt/url-monitor/app
nano next.config.js
```

Update to:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Environment variables
  env: {
    DATABASE_PATH: process.env.DATABASE_PATH,
    CRON_SECRET: process.env.CRON_SECRET,
    // Keep Turso vars for backward compatibility (not used with local SQLite)
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
  },
}

module.exports = nextConfig
```

### 6.8 Verify Default Admin User

The database initialization script creates a default admin user:

- **Username**: `admin`
- **Password**: `admin123` (⚠️ **CHANGE THIS IMMEDIATELY IN PRODUCTION**)

To change the admin password:

```bash
# Connect to database
sqlite3 /opt/url-monitor/database/url_monitor.db

# Update password (use bcrypt hash in production)
UPDATE admin_users SET password_hash = 'your-new-secure-password' WHERE username = 'admin';

# Verify
SELECT username FROM admin_users;

# Exit
.quit
```

---

## 7. Process Management

### 7.1 Create PM2 Ecosystem File

```bash
# Create PM2 configuration
cd /opt/url-monitor/app
nano ecosystem.config.js
```

Add the following configuration:

```javascript
module.exports = {
  apps: [{
    name: 'url-monitor',
    script: 'node_modules/next/dist/bin/next',
    args: 'start',
    cwd: '/opt/url-monitor/app',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      DATABASE_PATH: '/opt/url-monitor/database/url_monitor.db',
      CRON_SECRET: process.env.CRON_SECRET, // Load from .env file
    },
    env_file: '/opt/url-monitor/app/.env',
    error_file: '/opt/url-monitor/logs/pm2-error.log',
    out_file: '/opt/url-monitor/logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '1G',
  }]
};
```

### 7.2 Start Application with PM2

```bash
# Load environment variables
cd /opt/url-monitor/app
export $(cat .env | xargs)

# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup

# Follow the instructions provided by PM2 to enable startup script
# Usually: sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u urlmonitor --hp /home/urlmonitor
```

### 7.3 PM2 Management Commands

```bash
# Check application status
pm2 status

# View logs
pm2 logs url-monitor

# View last 50 lines
pm2 logs url-monitor --lines 50

# Restart application
pm2 restart url-monitor

# Stop application
pm2 stop url-monitor

# Reload application (zero-downtime)
pm2 reload url-monitor

# Monitor application
pm2 monit

# View detailed information
pm2 show url-monitor

# View process info
pm2 info url-monitor
```

### 7.4 Alternative: systemd Service (Optional)

If you prefer systemd over PM2, create a service file:

```bash
sudo nano /etc/systemd/system/url-monitor.service
```

Add the following:

```ini
[Unit]
Description=URL Monitor Service
After=network.target

[Service]
Type=simple
User=urlmonitor
Group=urlmonitor
WorkingDirectory=/opt/url-monitor/app
Environment="NODE_ENV=production"
Environment="PORT=3000"
Environment="DATABASE_PATH=/opt/url-monitor/database/url_monitor.db"
EnvironmentFile=/opt/url-monitor/app/.env
ExecStart=/usr/bin/node node_modules/next/dist/bin/next start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=url-monitor

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service
sudo systemctl enable url-monitor

# Start service
sudo systemctl start url-monitor

# Check status
sudo systemctl status url-monitor

# View logs
sudo journalctl -u url-monitor -f
```

---

## 8. Web Server Configuration (Nginx)

### 8.1 Install Nginx

```bash
# Ubuntu/Debian
sudo apt install -y nginx

# CentOS/RHEL
sudo yum install -y nginx

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 8.2 Create Nginx Configuration

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/url-monitor
```

Add the following configuration:

```nginx
# Upstream configuration
upstream url_monitor {
    server 127.0.0.1:3000;
    keepalive 64;
}

# HTTP Server - Redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name monitor.yourcampus.edu;

    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect all HTTP to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name monitor.yourcampus.edu;

    # SSL Configuration (will be updated by Certbot)
    ssl_certificate /etc/letsencrypt/live/monitor.yourcampus.edu/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/monitor.yourcampus.edu/privkey.pem;
    
    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Logging
    access_log /var/log/nginx/url-monitor-access.log;
    error_log /var/log/nginx/url-monitor-error.log;

    # Client settings
    client_max_body_size 10M;
    client_body_timeout 60s;
    client_header_timeout 60s;

    # Proxy settings
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;

    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    # Main location
    location / {
        proxy_pass http://url_monitor;
        proxy_redirect off;
    }

    # Health check endpoint (optional)
    location /health {
        access_log off;
        proxy_pass http://url_monitor/api/check;
    }
}
```

**Note**: Replace `monitor.yourcampus.edu` with your actual domain name.

### 8.3 Enable Site Configuration

```bash
# Ubuntu/Debian
sudo ln -s /etc/nginx/sites-available/url-monitor /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### 8.4 Verify Nginx Status

```bash
# Check Nginx status
sudo systemctl status nginx

# Check if port 80 and 443 are listening
sudo netstat -tlnp | grep nginx
# or
sudo ss -tlnp | grep nginx
```

---

## 9. SSL Certificate Setup

### 9.1 Install Certbot

```bash
# Ubuntu/Debian
sudo apt install -y certbot python3-certbot-nginx

# CentOS/RHEL
sudo yum install -y certbot python3-certbot-nginx
```

### 9.2 Obtain SSL Certificate

```bash
# Obtain certificate using Nginx plugin
sudo certbot --nginx -d monitor.yourcampus.edu

# Follow the prompts:
# - Enter email address
# - Agree to terms
# - Choose whether to redirect HTTP to HTTPS (recommended: Yes)
```

### 9.3 Verify Certificate

```bash
# Test certificate renewal
sudo certbot renew --dry-run

# Check certificate expiration
sudo certbot certificates
```

### 9.4 Auto-Renewal Setup

Certbot automatically creates a systemd timer for renewal. Verify it's enabled:

```bash
# Check timer status
sudo systemctl status certbot.timer

# Enable if not already enabled
sudo systemctl enable certbot.timer

# List timers
sudo systemctl list-timers | grep certbot
```

### 9.5 Alternative: Self-Signed Certificate (For Testing)

If you can't use Let's Encrypt (e.g., internal-only network):

```bash
# Create self-signed certificate
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/url-monitor.key \
  -out /etc/ssl/certs/url-monitor.crt

# Update Nginx configuration to use self-signed cert
sudo nano /etc/nginx/sites-available/url-monitor
```

Update SSL certificate paths:

```nginx
ssl_certificate /etc/ssl/certs/url-monitor.crt;
ssl_certificate_key /etc/ssl/private/url-monitor.key;
```

---

## 10. Cron Job Configuration

### 10.1 Understanding Scheduled Checks

The application runs scheduled checks at specific times in **Central Time (America/Chicago)**:
- **7:50 AM CT** - Morning check
- **1:00 PM CT** - Afternoon check (also runs archive process)

The cron endpoint validates the time window (5-minute tolerance) to prevent unauthorized access.

### 10.2 Create Cron Script

Create a script to call the cron endpoint:

```bash
# Create cron script
sudo nano /opt/url-monitor/scripts/run-cron.sh
```

Add the following:

```bash
#!/bin/bash
# Cron Job Script for URL Monitoring

# Load environment variables
source /opt/url-monitor/app/.env

CRON_SECRET="${CRON_SECRET}"
APP_URL="${NEXT_PUBLIC_APP_URL:-https://monitor.yourcampus.edu}"

# Call cron endpoint
response=$(curl -X GET "${APP_URL}/api/cron" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  --max-time 300 \
  --silent \
  --show-error \
  --write-out "\nHTTP_CODE:%{http_code}")

# Extract HTTP code
http_code=$(echo "$response" | grep -oP 'HTTP_CODE:\K[0-9]+')
response_body=$(echo "$response" | sed 's/HTTP_CODE:[0-9]*$//')

# Log result
if [ "$http_code" -eq 200 ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S'): Cron job executed successfully" >> /opt/url-monitor/logs/cron.log
    echo "$response_body" >> /opt/url-monitor/logs/cron.log
else
    echo "$(date '+%Y-%m-%d %H:%M:%S'): Cron job failed with HTTP $http_code" >> /opt/url-monitor/logs/cron.log
    echo "$response_body" >> /opt/url-monitor/logs/cron.log
fi
```

Make it executable:

```bash
chmod +x /opt/url-monitor/scripts/run-cron.sh
```

### 10.3 Configure Crontab

```bash
# Edit crontab for application user
crontab -e
```

Add the following entries. **Note**: Adjust UTC times based on Central Time and daylight saving:

```cron
# URL Monitoring Cron Jobs
# Central Time: 7:50 AM CT = 12:50 UTC (CST) or 13:50 UTC (CDT)
# Central Time: 1:00 PM CT = 19:00 UTC (CST) or 20:00 UTC (CDT)
# 
# Run at 7:50 AM Central Time (covers both CST and CDT)
50 12,13 * * * /opt/url-monitor/scripts/run-cron.sh >> /opt/url-monitor/logs/cron.log 2>&1

# Run at 1:00 PM Central Time (covers both CST and CDT) - also runs archive
0 19,20 * * * /opt/url-monitor/scripts/run-cron.sh >> /opt/url-monitor/logs/cron.log 2>&1

# Database backup daily at 2:00 AM Central Time (8:00 UTC CST, 7:00 UTC CDT)
0 7,8 * * * /opt/url-monitor/scripts/backup-db.sh >> /opt/url-monitor/logs/backup.log 2>&1
```

**Note**: The times above cover both Central Standard Time (CST) and Central Daylight Time (CDT). Adjust if your server timezone differs.

### 10.4 Verify Cron Jobs

```bash
# List cron jobs
crontab -l

# Check cron logs
tail -f /opt/url-monitor/logs/cron.log

# Test cron script manually
/opt/url-monitor/scripts/run-cron.sh

# Check system cron logs
sudo tail -f /var/log/syslog | grep CRON
```

---

## 11. Firewall Configuration

### 11.1 Configure UFW (Ubuntu/Debian)

```bash
# Install UFW if not installed
sudo apt install -y ufw

# Allow SSH (important - do this first!)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable UFW
sudo ufw enable

# Check status
sudo ufw status verbose
```

### 11.2 Configure firewalld (CentOS/RHEL)

```bash
# Start and enable firewalld
sudo systemctl start firewalld
sudo systemctl enable firewalld

# Allow SSH
sudo firewall-cmd --permanent --add-service=ssh

# Allow HTTP and HTTPS
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https

# Reload firewall
sudo firewall-cmd --reload

# Check status
sudo firewall-cmd --list-all
```

### 11.3 Verify Firewall Rules

```bash
# Check listening ports
sudo netstat -tlnp
# or
sudo ss -tlnp

# Test from external machine (if possible)
# telnet your-server-ip 443
```

---

## 12. Security Hardening

### 12.1 SSH Security

```bash
# Edit SSH configuration
sudo nano /etc/ssh/sshd_config
```

Recommended settings:

```
PermitRootLogin no
PasswordAuthentication yes  # Or no if using keys only
PubkeyAuthentication yes
AllowUsers urlmonitor
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
```

Restart SSH:

```bash
sudo systemctl restart sshd
```

### 12.2 Fail2Ban Installation

```bash
# Install Fail2Ban
sudo apt install -y fail2ban  # Ubuntu/Debian
sudo yum install -y fail2ban   # CentOS/RHEL

# Start and enable
sudo systemctl start fail2ban
sudo systemctl enable fail2ban

# Check status
sudo fail2ban-client status
```

### 12.3 Application Security

#### Update Admin Password

```bash
# Connect to database
sqlite3 /opt/url-monitor/database/url_monitor.db

# Update admin password (use bcrypt hash in production)
UPDATE admin_users SET password_hash = 'your-new-secure-password' WHERE username = 'admin';

# Verify
SELECT username FROM admin_users;

# Exit
.quit
```

#### Implement Password Hashing (Recommended)

Install bcrypt:

```bash
cd /opt/url-monitor/app
npm install bcrypt
npm install --save-dev @types/bcrypt
```

Update authentication logic in `app/api/auth/login/route.ts` to use bcrypt for password hashing.

### 12.4 File Permissions

```bash
# Set proper permissions
sudo chown -R urlmonitor:urlmonitor /opt/url-monitor
sudo chmod 750 /opt/url-monitor
sudo chmod 640 /opt/url-monitor/app/.env
sudo chmod 660 /opt/url-monitor/database/url_monitor.db
sudo chmod 755 /opt/url-monitor/scripts/*.sh
```

### 12.5 Regular Security Updates

```bash
# Set up automatic security updates
# Ubuntu/Debian
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# CentOS/RHEL
sudo yum install -y yum-cron
sudo systemctl enable yum-cron
sudo systemctl start yum-cron
```

---

## 13. Monitoring & Maintenance

### 13.1 Application Monitoring

#### PM2 Monitoring

```bash
# Monitor application
pm2 monit

# View metrics
pm2 describe url-monitor

# View process info
pm2 info url-monitor
```

#### Log Monitoring

```bash
# Application logs
tail -f /opt/url-monitor/logs/pm2-out.log
tail -f /opt/url-monitor/logs/pm2-error.log

# Nginx logs
sudo tail -f /var/log/nginx/url-monitor-access.log
sudo tail -f /var/log/nginx/url-monitor-error.log

# Cron logs
tail -f /opt/url-monitor/logs/cron.log

# Backup logs
tail -f /opt/url-monitor/logs/backup.log
```

### 13.2 System Monitoring

#### Install Monitoring Tools

```bash
# Install htop for process monitoring
sudo apt install -y htop  # Ubuntu/Debian
sudo yum install -y htop   # CentOS/RHEL

# Install iotop for I/O monitoring
sudo apt install -y iotop  # Ubuntu/Debian
sudo yum install -y iotop   # CentOS/RHEL
```

#### Disk Space Monitoring

```bash
# Check disk usage
df -h

# Check database size
du -sh /opt/url-monitor/database/

# Check log sizes
du -sh /opt/url-monitor/logs/

# Check backup sizes
du -sh /opt/url-monitor/backups/
```

### 13.3 Database Maintenance

#### Regular Cleanup

Create a cleanup script:

```bash
sudo nano /opt/url-monitor/scripts/cleanup-db.sh
```

```bash
#!/bin/bash
# Database Cleanup Script

DB_FILE="/opt/url-monitor/database/url_monitor.db"

# Vacuum database to reclaim space
sqlite3 "$DB_FILE" "VACUUM;"

# Analyze database for query optimization
sqlite3 "$DB_FILE" "ANALYZE;"

echo "$(date): Database cleanup completed" >> /opt/url-monitor/logs/cleanup.log
```

Make executable and add to crontab:

```bash
chmod +x /opt/url-monitor/scripts/cleanup-db.sh

# Add to crontab (weekly on Sunday at 3 AM Central Time)
# 0 8,9 * * 0 /opt/url-monitor/scripts/cleanup-db.sh
```

### 13.4 Health Check Endpoint

Test the application health:

```bash
# Test health endpoint
curl https://monitor.yourcampus.edu/api/check

# Or test locally
curl http://localhost:3000/api/check

# Test cron endpoint (with authentication)
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://monitor.yourcampus.edu/api/cron
```

### 13.5 Database Query Examples

```bash
# Connect to database
sqlite3 /opt/url-monitor/database/url_monitor.db

# View all URLs
SELECT id, name, url, environment FROM urls;

# View latest status for all URLs
SELECT u.name, us.status_code, us.is_up, us.checked_at 
FROM urls u 
LEFT JOIN url_status us ON u.id = us.url_id 
ORDER BY us.checked_at DESC 
LIMIT 10;

# Count status records per URL
SELECT u.name, COUNT(us.id) as check_count 
FROM urls u 
LEFT JOIN url_status us ON u.id = us.url_id 
GROUP BY u.id;

# View archived records count
SELECT COUNT(*) FROM archived_url_status;

# Exit
.quit
```

---

## 14. Troubleshooting

### 14.1 Application Won't Start

```bash
# Check PM2 logs
pm2 logs url-monitor --lines 50

# Check if port is in use
sudo netstat -tlnp | grep 3000

# Check Node.js version
node --version

# Verify environment variables
pm2 show url-monitor

# Check database file permissions
ls -la /opt/url-monitor/database/

# Test database connection
sqlite3 /opt/url-monitor/database/url_monitor.db "SELECT 1;"
```

### 14.2 Database Issues

```bash
# Check database file permissions
ls -la /opt/url-monitor/database/

# Test database connection
sqlite3 /opt/url-monitor/database/url_monitor.db "SELECT COUNT(*) FROM urls;"

# Check database integrity
sqlite3 /opt/url-monitor/database/url_monitor.db "PRAGMA integrity_check;"

# Check database schema
sqlite3 /opt/url-monitor/database/url_monitor.db ".schema"

# View table info
sqlite3 /opt/url-monitor/database/url_monitor.db ".tables"
```

### 14.3 Nginx Issues

```bash
# Test Nginx configuration
sudo nginx -t

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/url-monitor-error.log

# Check if Nginx is running
sudo systemctl status nginx

# Restart Nginx
sudo systemctl restart nginx

# Check if application is responding on port 3000
curl http://localhost:3000
```

### 14.4 SSL Certificate Issues

```bash
# Check certificate expiration
sudo certbot certificates

# Renew certificate manually
sudo certbot renew

# Check certificate files
sudo ls -la /etc/letsencrypt/live/monitor.yourcampus.edu/

# Test SSL connection
openssl s_client -connect monitor.yourcampus.edu:443 -servername monitor.yourcampus.edu
```

### 14.5 Cron Job Issues

```bash
# Check cron logs
tail -f /opt/url-monitor/logs/cron.log

# Test cron script manually
/opt/url-monitor/scripts/run-cron.sh

# Check crontab
crontab -l

# Check system cron logs
sudo tail -f /var/log/syslog | grep CRON

# Verify CRON_SECRET is set
grep CRON_SECRET /opt/url-monitor/app/.env

# Test cron endpoint directly
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://monitor.yourcampus.edu/api/cron
```

### 14.6 Network Connectivity Issues

```bash
# Test DNS resolution
nslookup monitor.yourcampus.edu

# Test HTTP connectivity
curl -I http://localhost:3000

# Test HTTPS connectivity
curl -I https://monitor.yourcampus.edu

# Check firewall rules
sudo ufw status  # Ubuntu/Debian
sudo firewall-cmd --list-all  # CentOS/RHEL

# Test outbound connectivity (for URL checks)
curl -I https://www.google.com
```

### 14.7 Browser Check Issues

If browser-based checks aren't working:

1. Verify the browser check endpoint is accessible
2. Check browser console for errors
3. Verify CORS settings if accessing from different domain
4. Check that browser checks are saving to database correctly

---

## 15. Backup & Recovery

### 15.1 Backup Strategy

#### Database Backup

The backup script created earlier (`backup-db.sh`) should be run daily. Verify it's working:

```bash
# Run backup manually
/opt/url-monitor/scripts/backup-db.sh

# Check backup files
ls -lh /opt/url-monitor/backups/

# Verify backup integrity
gunzip -t /opt/url-monitor/backups/url_monitor_*.db.gz
```

#### Application Backup

```bash
# Create application backup script
sudo nano /opt/url-monitor/scripts/backup-app.sh
```

```bash
#!/bin/bash
# Application Backup Script

BACKUP_DIR="/opt/url-monitor/backups"
APP_DIR="/opt/url-monitor/app"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/app_backup_${TIMESTAMP}.tar.gz"

# Create backup
tar -czf "$BACKUP_FILE" \
  -C /opt/url-monitor \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.git' \
  app/

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "app_backup_*.tar.gz" -mtime +7 -delete

echo "Application backup completed: ${BACKUP_FILE}"
```

Make executable:

```bash
chmod +x /opt/url-monitor/scripts/backup-app.sh
```

### 15.2 Recovery Procedures

#### Database Recovery

```bash
# Stop application
pm2 stop url-monitor

# Restore database from backup
cp /opt/url-monitor/backups/url_monitor_YYYYMMDD_HHMMSS.db.gz /tmp/
gunzip /tmp/url_monitor_YYYYMMDD_HHMMSS.db.gz
cp /tmp/url_monitor_YYYYMMDD_HHMMSS.db /opt/url-monitor/database/url_monitor.db

# Set permissions
chmod 660 /opt/url-monitor/database/url_monitor.db
chown urlmonitor:urlmonitor /opt/url-monitor/database/url_monitor.db

# Verify database integrity
sqlite3 /opt/url-monitor/database/url_monitor.db "PRAGMA integrity_check;"

# Start application
pm2 start url-monitor
```

#### Application Recovery

```bash
# Stop application
pm2 stop url-monitor

# Restore application from backup
tar -xzf /opt/url-monitor/backups/app_backup_YYYYMMDD_HHMMSS.tar.gz -C /opt/url-monitor/

# Reinstall dependencies
cd /opt/url-monitor/app
npm install --production

# Rebuild application
npm run build

# Start application
pm2 start url-monitor
```

### 15.3 Off-Site Backup (Recommended)

Set up automated off-site backups:

```bash
# Install rsync if not present
sudo apt install -y rsync  # Ubuntu/Debian
sudo yum install -y rsync  # CentOS/RHEL

# Create backup script for off-site transfer
sudo nano /opt/url-monitor/scripts/backup-offsite.sh
```

```bash
#!/bin/bash
# Off-site Backup Script

BACKUP_DIR="/opt/url-monitor/backups"
REMOTE_HOST="backup-server.yourcampus.edu"
REMOTE_USER="backup-user"
REMOTE_PATH="/backups/url-monitor"

# Sync backups to remote server
rsync -avz --delete "$BACKUP_DIR/" \
  "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/"

echo "$(date): Off-site backup completed" >> /opt/url-monitor/logs/backup.log
```

Make executable and add to crontab:

```bash
chmod +x /opt/url-monitor/scripts/backup-offsite.sh

# Add to crontab (daily at 3 AM Central Time)
# 0 8,9 * * * /opt/url-monitor/scripts/backup-offsite.sh
```

---

## Appendix A: Quick Reference Commands

### Application Management

```bash
# Start application
pm2 start url-monitor

# Stop application
pm2 stop url-monitor

# Restart application
pm2 restart url-monitor

# View logs
pm2 logs url-monitor

# Monitor application
pm2 monit

# View status
pm2 status
```

### Database Management

```bash
# Connect to database
sqlite3 /opt/url-monitor/database/url_monitor.db

# View tables
.tables

# View URLs
SELECT id, name, url, environment FROM urls;

# View latest status
SELECT u.name, us.status_code, us.is_up, us.checked_at 
FROM urls u 
LEFT JOIN url_status us ON u.id = us.url_id 
ORDER BY us.checked_at DESC 
LIMIT 10;

# Count records
SELECT COUNT(*) FROM url_status;
SELECT COUNT(*) FROM archived_url_status;

# Backup database
/opt/url-monitor/scripts/backup-db.sh
```

### Service Management

```bash
# Nginx
sudo systemctl status nginx
sudo systemctl restart nginx
sudo nginx -t

# PM2
pm2 status
pm2 save
pm2 startup

# Cron
crontab -l
crontab -e
```

---

## Appendix B: Environment Variables Reference

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `DATABASE_PATH` | Path to SQLite database file | `/opt/url-monitor/database/url_monitor.db` | Yes (for local) |
| `NODE_ENV` | Node.js environment | `production` | Yes |
| `PORT` | Application port | `3000` | Yes |
| `CRON_SECRET` | Secret for cron endpoint authentication | `random-hex-string` | Yes |
| `NEXT_PUBLIC_APP_URL` | Public URL of the application | `https://monitor.yourcampus.edu` | Recommended |
| `TURSO_DATABASE_URL` | Turso database URL (not used with local SQLite) | - | No |
| `TURSO_AUTH_TOKEN` | Turso auth token (not used with local SQLite) | - | No |

---

## Appendix C: Database Schema Reference

### Tables

1. **urls** - Monitored URLs
2. **url_status** - Recent status checks (last 7 days)
3. **archived_url_status** - Archived status records (older than 7 days)
4. **admin_users** - Administrator accounts

### Key Fields

- **url_status.response_time**: Stored in milliseconds (despite field name)
- **url_status.location**: Redirect location header (for 301/302 responses)
- **url_status.is_up**: Boolean (1 = up, 0 = down)
- **urls.environment**: 'testing' or 'production'

### Data Retention

- Active records: Last 7 days in `url_status`
- Archive: Records older than 7 days moved to `archived_url_status`
- Archive process: Runs daily at 1:00 PM Central Time

---

## Appendix D: API Endpoints Reference

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/urls` | GET | Get all URLs with latest status | No |
| `/api/urls` | POST | Add new URL | No (should be) |
| `/api/urls/[id]` | GET | Get URL details with history | No |
| `/api/urls/[id]` | PUT | Update URL | No (should be) |
| `/api/urls/[id]` | DELETE | Delete URL | No (should be) |
| `/api/check` | POST | Manually check all URLs | No (should be) |
| `/api/check/browser` | POST | Save browser check results | No (should be) |
| `/api/cron` | GET/POST | Scheduled checks endpoint | CRON_SECRET |
| `/api/archive` | GET | Get archive status | No |
| `/api/archive` | POST | Run archive process | Session or CRON_SECRET |
| `/api/auth/login` | POST | Admin login | No |
| `/api/auth/logout` | POST | Admin logout | No |
| `/api/auth/session` | GET | Check session | No |

---

## Appendix E: Port Reference

| Port | Service | Protocol | Access |
|------|---------|----------|--------|
| 22 | SSH | TCP | Internal/Admin |
| 80 | HTTP | TCP | Public (redirects to HTTPS) |
| 443 | HTTPS | TCP | Public |
| 3000 | Next.js App | TCP | Localhost only (via Nginx) |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 2.0 | 2024 | Development Team | Complete rewrite based on actual codebase - local SQLite support, accurate database schema, current API endpoints |
| 1.0 | 2024 | Development Team | Initial Linux server setup guide |

---

**End of Document**
