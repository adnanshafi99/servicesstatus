# Quick Deployment Checklist

## 🚀 Quick Steps to Deploy to Vercel

### Step 1: Prepare Your Code

1. **Initialize Git** (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Ready for deployment"
   ```

2. **Create GitHub Repository**:
   - Go to https://github.com/new
   - Create a new repository (e.g., `url-monitor`)
   - **Don't** initialize with README

3. **Push to GitHub**:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git branch -M main
   git push -u origin main
   ```

### Step 2: Deploy to Vercel

1. **Go to Vercel**: https://vercel.com
2. **Sign in** with your GitHub account
3. **Click "Add New..." → "Project"**
4. **Import** your GitHub repository
5. **Configure**:
   - Framework: Next.js (auto-detected)
   - Root Directory: `./`
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)

### Step 3: Add Environment Variables

**IMPORTANT**: Add these 3 environment variables in Vercel:

1. **TURSO_DATABASE_URL**
   - Your Turso database URL
   - Select: Production, Preview, Development

2. **TURSO_AUTH_TOKEN**
   - Your Turso authentication token
   - Select: Production, Preview, Development

3. **CRON_SECRET**
   - Generate a random secret (e.g., use: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - Select: Production, Preview, Development

### Step 4: Deploy

Click **"Deploy"** and wait 2-3 minutes for the build to complete.

### Step 5: Verify Cron Jobs

After deployment:
1. Go to **Project Settings** → **Cron Jobs**
2. Verify cron jobs are configured (should be automatic from `vercel.json`)
3. For each cron job, add Authorization header:
   - Header: `Authorization`
   - Value: `Bearer YOUR_CRON_SECRET`

### Step 6: Test Your Deployment

1. Visit your app: `https://your-project.vercel.app`
2. Test homepage: Should show service status
3. Test admin: `https://your-project.vercel.app/admin`
4. Login with: `admin` / `admin123`
5. Add a URL and test functionality

## ✅ Checklist

- [ ] Code pushed to GitHub
- [ ] Vercel project created
- [ ] Environment variables added
- [ ] Deployment successful
- [ ] Cron jobs configured
- [ ] Application tested
- [ ] Admin password changed (recommended)

## 🔒 Security Reminder

**Change the default admin password** after first login:
- Current: `admin` / `admin123`
- Update the password hash in the database or implement password change feature

## 📝 Notes

- Your app URL: `https://your-project-name.vercel.app`
- Cron jobs run automatically (7:50 AM, 1:00 PM, 10:00 PM CT)
- Archive runs daily at 5:00 AM UTC
- Database initializes automatically on first use

## 🆘 Troubleshooting

- **Build fails?** Check build logs in Vercel dashboard
- **Database error?** Verify environment variables are correct
- **Cron not working?** Check cron jobs in Vercel settings
- **Need help?** Check full deployment guide in `DEPLOYMENT.md`

