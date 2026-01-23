# FoxTooth Backend Documentation

Welcome to the FoxTooth Backend documentation. This is your central hub for all information about building, deploying, and integrating with our enterprise-grade game server infrastructure.

---

## 📋 Quick Navigation

### 🚀 Getting Started
Start here if you're new to FoxTooth Backend:
- **[Getting Started Guide](guides/GETTING_STARTED.md)** - Quick setup in 30 minutes
- **[System Overview](SYSTEM_OVERVIEW.md)** - Understand the architecture and core concepts
- **[MASTER_DOCUMENTATION.md](MASTER_DOCUMENTATION.md)** - Comprehensive deep dive into all systems

### 🔌 API Documentation
Learn how to use our REST and WebSocket APIs:
- **[API Reference](api/API_REFERENCE.md)** - Complete endpoint documentation with examples
- **[Friends System](api/FRIENDS_SYSTEM.md)** - Friend request and management system

### 📦 Deployment & Operations
Deploy and manage your production environment:
- **[Deployment Guide](guides/DEPLOYMENT_GUIDE.md)** - Step-by-step deployment instructions
- **[Production Readiness](guides/PRODUCTION_READINESS.md)** - Pre-launch checklist

### 🔐 Security
Understand security features and best practices:
- **[Security Audit](security/SECURITY_AUDIT.md)** - Comprehensive security documentation

### 🎮 Integration
Integrate FoxTooth with your game client:
- **[Unity Integration](integration/UNITY_INTEGRATION.md)** - Unity game engine integration
- **[AI Assistant Guide](integration/AI_ASSISTANT_GUIDE.md)** - Using AI for game logic and features

### 🧪 Testing
Test and validate your implementation:
- **[Test Client](testing/test-client.js)** - JavaScript test client for API validation

---

## 📚 Documentation Structure

```
docs/
├── README.md                          ← You are here
├── SYSTEM_OVERVIEW.md                 ← Architecture & system design
├── MASTER_DOCUMENTATION.md            ← Complete reference
│
├── api/
│   ├── API_REFERENCE.md              ← All REST endpoints
│   └── FRIENDS_SYSTEM.md             ← Friends management
│
├── guides/
│   ├── GETTING_STARTED.md            ← 30-minute setup
│   ├── DEPLOYMENT_GUIDE.md           ← Production deployment
│   └── PRODUCTION_READINESS.md       ← Launch checklist
│
├── security/
│   └── SECURITY_AUDIT.md             ← Security features
│
├── integration/
│   ├── UNITY_INTEGRATION.md          ← Unity client guide
│   └── AI_ASSISTANT_GUIDE.md         ← AI integration
│
├── testing/
│   └── test-client.js                ← API test utility
│
├── deprecated/                        ← Legacy documentation
└── archived/                          ← Old versions
```

---

## 🎯 Common Tasks

### I want to...

**...deploy FoxTooth to production**
1. Read [Getting Started](guides/GETTING_STARTED.md)
2. Follow [Deployment Guide](guides/DEPLOYMENT_GUIDE.md)
3. Review [Production Readiness](guides/PRODUCTION_READINESS.md) checklist
4. Check [Security Audit](security/SECURITY_AUDIT.md) for best practices

**...integrate with my Unity game**
1. Start with [Getting Started](guides/GETTING_STARTED.md)
2. Read [API Reference](api/API_REFERENCE.md) for endpoint details
3. Follow [Unity Integration Guide](integration/UNITY_INTEGRATION.md)
4. Test with [test-client.js](testing/test-client.js)

**...understand the system architecture**
1. Read [System Overview](SYSTEM_OVERVIEW.md)
2. Review [MASTER_DOCUMENTATION.md](MASTER_DOCUMENTATION.md) for deep dive
3. Check [API Reference](api/API_REFERENCE.md) for endpoint flows

**...implement friend requests**
1. Review [Friends System](api/FRIENDS_SYSTEM.md)
2. Read [API Reference - Friends endpoints](api/API_REFERENCE.md)
3. Check [AI Assistant Guide](integration/AI_ASSISTANT_GUIDE.md) for advanced patterns

**...set up security correctly**
1. Read [Security Audit](security/SECURITY_AUDIT.md)
2. Follow [Deployment Guide - Security section](guides/DEPLOYMENT_GUIDE.md)
3. Test with [test-client.js](testing/test-client.js)

---

## 📊 System Features

✅ **21+ REST Endpoints** - Complete API for player management
✅ **WebSocket Support** - Real-time multiplayer features
✅ **JWT Authentication** - Secure token-based auth
✅ **Friend System** - Friend requests with real-time notifications
✅ **Game Sessions** - Multiplayer session management
✅ **Leaderboards** - Global and friend rankings
✅ **100% Test Coverage** - Fully tested codebase
✅ **Production Ready** - Enterprise-grade reliability

---

## 🔧 Key Technology Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js 18+ |
| Framework | Express.js |
| Real-Time | Socket.IO (WebSockets) |
| Database | PostgreSQL 13+ |
| Authentication | JWT + Bcrypt |
| Containerization | Docker |
| Logging | Winston + Morgan |

---

## 📞 Need Help?

- **API Questions** → See [API Reference](api/API_REFERENCE.md)
- **Deployment Issues** → Check [Deployment Guide](guides/DEPLOYMENT_GUIDE.md)
- **Security Concerns** → Review [Security Audit](security/SECURITY_AUDIT.md)
- **Integration Help** → Read integration guides in `/integration`
- **Testing** → Use [test-client.js](testing/test-client.js)

---

## 📅 Document Status

| Document | Updated | Status |
|----------|---------|--------|
| Getting Started | Oct 2025 | ✅ Current |
| API Reference | Oct 2025 | ✅ Current |
| System Overview | Jan 2026 | ✅ Current |
| Deployment Guide | Oct 2025 | ✅ Current |
| Security Audit | Oct 2025 | ✅ Current |
| Unity Integration | Oct 2025 | ✅ Current |

---

**Last Updated:** January 22, 2026  
**Version:** 1.0.0  
**Status:** Production Ready

---

## Running the Documentation Server

This folder contains Markdown documentation served by the project's local docs server:

```powershell
npm run start:docs
```

Then open http://localhost:8080/ in your browser to view the organized documentation.

