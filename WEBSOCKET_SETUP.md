# WebSocket Real-Time Monitoring Setup

## Prerequisites

### 1. Install Redis

#### Option A: Windows (Using Docker - Recommended)

```powershell
# Install Docker Desktop first, then:
docker run -d --name redis-saristorepros -p 6379:6379 redis:latest
```

#### Option B: Windows (Using Memurai)

1. Download Memurai from: https://www.memurai.com/get-memurai
2. Install and run Memurai
3. It will run on port 6379 by default

#### Option C: WSL2 (Windows Subsystem for Linux)

```bash
# Enable WSL2
wsl --install

# Inside WSL terminal:
sudo apt update
sudo apt install redis-server
sudo service redis-server start
```

### 2. Install Python Dependencies

```powershell
cd backend
pip install -r requirements.txt
```

### 3. Test Redis Connection

```powershell
# In Python
python -c "import redis; r = redis.Redis(host='localhost', port=6379); print('Redis connected:', r.ping())"
```

## Running the Application

### 1. Start Redis (if not already running)

```powershell
# If using Docker:
docker start redis-saristorepros

# If using Memurai: Start Memurai from Start Menu
# If using WSL: wsl -e sudo service redis-server start
```

### 2. Start Django with Daphne (ASGI Server)

```powershell
cd backend
python -m daphne -b 0.0.0.0 -p 8000 pos.asgi:application
```

**Alternative: Use manage.py runserver (development only)**

```powershell
cd backend
python manage.py runserver
```

Note: Django's runserver doesn't support WebSockets well. Use Daphne for WebSocket support.

### 3. Start Frontend

```powershell
cd frontend
npm run dev
```

## Configuration

### Environment Variables

Create/update `.env` file in backend:

```env
# Redis Configuration
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# WebSocket Port (if different from Django)
WS_PORT=8000
```

Create/update `.env` file in frontend:

```env
# WebSocket Configuration
VITE_WS_PORT=8000
```

## Testing WebSocket Connection

### 1. Check Django Console

You should see:

```
WebSocket HANDSHAKING /ws/realtime/ [127.0.0.1:xxxxx]
WebSocket CONNECT /ws/realtime/ [127.0.0.1:xxxxx]
```

### 2. Browser Console

Open browser DevTools → Network → WS tab
You should see:

- Connection to `ws://localhost:8000/ws/realtime/`
- Status: 101 Switching Protocols
- Messages being sent/received

### 3. Check Live Indicator

Look for the "Live" badge in the bottom-right corner of the app:

- Green "Live" = Connected
- Red "Offline" = Disconnected

## Real-Time Features

Once connected, the following will update in real-time across all clients:

### Dashboard

- Total sales count
- Revenue updates
- Low stock alerts

### Inventory

- Product additions
- Stock quantity changes
- Product updates

### Sales

- New sales appear instantly
- Sale list updates

### Admin

- Shift start/end notifications
- Employee performance updates
- Active shifts monitoring

## Troubleshooting

### Redis Not Connecting

```powershell
# Check if Redis is running
# For Docker:
docker ps | findstr redis

# Test connection:
python -c "import redis; r = redis.Redis(); print(r.ping())"
```

### WebSocket Not Connecting

1. Check Daphne is running (not just runserver)
2. Check browser console for WebSocket errors
3. Verify CORS settings in Django
4. Check firewall/antivirus isn't blocking WebSocket

### "Live" Badge Shows Offline

1. Check backend console for WebSocket errors
2. Verify Redis is running
3. Check browser console Network tab for WS connection
4. Try refreshing the page

## Production Deployment

### Using Daphne

```bash
daphne -b 0.0.0.0 -p 8000 pos.asgi:application
```

### Using Supervisor (Linux)

```ini
[program:daphne]
command=/path/to/venv/bin/daphne -b 0.0.0.0 -p 8000 pos.asgi:application
directory=/path/to/backend
user=www-data
autostart=true
autorestart=true
```

### Using systemd (Linux)

Create `/etc/systemd/system/daphne.service`:

```ini
[Unit]
Description=Daphne ASGI Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/backend
ExecStart=/path/to/venv/bin/daphne -b 0.0.0.0 -p 8000 pos.asgi:application
Restart=always

[Install]
WantedBy=multi-user.target
```

## Performance Notes

- Redis memory usage: ~50-100MB for your scale
- WebSocket connections: ~10-20KB per client
- Recommended: 1-2 CPU cores, 512MB RAM minimum for Redis
- Supports 100+ concurrent WebSocket connections easily

## Cost Summary

- Development: **FREE** (local Redis)
- Production (self-hosted): **FREE** (include Redis on your server)
- Production (managed Redis): **$5-15/month** (optional, for scaling)
