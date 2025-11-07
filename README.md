# URL Monitor

A modern Next.js application for monitoring website URLs with automatic status checks using Turso (SQLite) database. Built with Shadcn UI components for a beautiful, responsive interface.

## Features

- ✅ **Modern UI** - Built with Shadcn UI components
- ✅ **Add and manage URLs** - Easy-to-use interface for monitoring URLs
- ✅ **Automatic status checks** - Runs 3 times per day (8 AM, 2 PM, 8 PM)
- ✅ **Real-time status display** - Shows current status with uptime percentage
- ✅ **Response time tracking** - Monitor website performance
- ✅ **Manual check option** - Trigger checks on demand
- ✅ **Responsive design** - Works on desktop and mobile
- ✅ **Dark mode support** - Automatic theme switching

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Turso** - SQLite database
- **Shadcn UI** - Beautiful component library
- **Tailwind CSS** - Styling
- **Lucide React** - Icons

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Turso Database

1. Sign up for a free account at [Turso](https://turso.tech/)
2. Create a new database
3. Get your database URL and auth token
4. Create a `.env` file in the root directory:

```env
TURSO_DATABASE_URL=your_turso_database_url
TURSO_AUTH_TOKEN=your_turso_auth_token
CRON_SECRET=your_secret_key_for_cron_endpoint
```

### 3. Initialize the Database

The database will be automatically initialized when you first add a URL through the API.

Or manually initialize:

```bash
npm run init-db
```

### 4. Run the Application

#### Development Mode

```bash
npm run dev
```

#### Production Mode

```bash
npm run build
npm start
```

## Deployment to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo>
git push -u origin main
```

### 2. Deploy to Vercel

1. Go to [Vercel](https://vercel.com)
2. Import your GitHub repository
3. Add environment variables in Vercel dashboard:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `CRON_SECRET` (optional but recommended)

### 3. Set Up Scheduled Checks

#### Option A: Vercel Cron Jobs (Recommended)

Add a `vercel.json` file (already included) and configure cron jobs in Vercel dashboard:

1. Go to your project settings in Vercel
2. Navigate to "Cron Jobs"
3. Add a new cron job:
   - **Path**: `/api/cron`
   - **Schedule**: `0 8,14,20 * * *` (8 AM, 2 PM, 8 PM UTC)
   - **Authorization**: Set `CRON_SECRET` header value

#### Option B: External Cron Service

Use services like:
- [Cron-job.org](https://cron-job.org/)
- [EasyCron](https://www.easycron.com/)

Configure it to call: `https://your-domain.vercel.app/api/cron` 3 times per day:
- 8:00 AM UTC
- 2:00 PM UTC
- 8:00 PM UTC

Set the Authorization header to: `Bearer your_cron_secret`

## API Endpoints

- `GET /api/urls` - Get all URLs with their latest status
- `POST /api/urls` - Add a new URL to monitor
- `DELETE /api/urls/[id]` - Delete a URL
- `GET /api/urls/[id]` - Get URL details with status history
- `POST /api/check` - Manually trigger checks for all URLs
- `GET /api/cron` - Cron endpoint for scheduled checks (requires auth)

## Project Structure

```
.
├── app/
│   ├── api/          # API routes
│   ├── page.tsx      # Main dashboard
│   └── layout.tsx    # Root layout
├── components/
│   └── ui/           # Shadcn UI components
├── lib/
│   ├── db.ts         # Database client
│   ├── ping.ts       # URL checking logic
│   ├── types.ts      # TypeScript types
│   └── utils.ts      # Utility functions
├── scripts/
│   └── setup-cron.ts # Cron scheduler
└── package.json
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `TURSO_DATABASE_URL` | Your Turso database URL | Yes |
| `TURSO_AUTH_TOKEN` | Your Turso authentication token | Yes |
| `CRON_SECRET` | Secret key for cron endpoint authentication | Recommended |

## License

MIT