# Server Management Commands

Simple instructions for starting and stopping the server and cron job.

## Start Server

```bash
cd /u01/app/uptime

# Start server in background
nohup npm run dev > server.log 2>&1 &

# Check if it's running
ps aux | grep "next dev" | grep -v grep

# View logs
tail -f server.log
```

## Stop Server

```bash
# Find the process ID
ps aux | grep "next dev" | grep -v grep

# Kill the process (replace PID with the actual process ID)
kill PID
```

## Start Cron Job

```bash
cd /u01/app/uptime

# Start cron scheduler in background
nohup npm run cron > cron.log 2>&1 &

# Verify it's running
ps aux | grep "setup-cron" | grep -v grep

# View logs
tail -f cron.log
```

## Stop Cron Job

```bash
# Find the process ID
ps aux | grep "setup-cron" | grep -v grep

# Kill the process (replace PID with the actual process ID)
kill PID
```

## Quick Reference

- **Start both**: Run the start commands for server and cron separately
- **Stop both**: Find and kill both processes
- **View logs**: Use `tail -f server.log` or `tail -f cron.log`
- **Check status**: Use `ps aux | grep` commands to verify processes are running







