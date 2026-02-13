# UniConnect — Verified Campus Social Network

UniConnect is a closed, mobile-first social networking platform built exclusively for university students.  
The system integrates official college ERP authentication to ensure every account belongs to a verified student, creating a trusted digital campus environment.

Unlike public social platforms, UniConnect eliminates anonymous users and fake accounts by validating identities against institutional records before granting access.

---

## Overview

UniConnect functions as a secure internal communication network where students can:

- maintain a verified profile
- share posts and media
- interact within a real academic community

The backend handles ERP verification, session management, and media delivery through RESTful APIs, while the mobile application provides a lightweight campus-social experience.

---

## Core Capabilities

### Secure Authentication
- Login via official college ERP credentials
- Backend validation through ERP API
- No public registration
- Only verified students can access the system

### Session Management
- Session-based authentication
- Persistent login without repeated ERP calls
- Reduced authentication latency
- Controlled access to protected endpoints

### Profile System
- Editable username and bio
- Profile & cover image upload
- Instant profile retrieval via API

### Posts & Media
- Image post uploads
- Caption support
- User profile feeds
- Static media serving from backend

### Media Handling
- Mobile gallery image picker
- File upload using Multer
- Local storage with Express static serving

---

## System Architecture

```
Mobile App (React Native)
        ↓
Node.js REST API (Express)
        ↓
ERP Authentication Service
        ↓
Session Creation & Protected Routes
        ↓
Media Storage & Retrieval
```

### Authentication Flow

1. User submits ERP credentials
2. Backend validates via ERP API
3. Session created
4. User gains access to protected endpoints
5. Subsequent requests authenticated via session

ERP is contacted **only once during login**, significantly improving performance.

---

## Tech Stack

### Mobile Client
- React Native
- Expo
- AsyncStorage
- Expo Image Picker

### Backend
- Node.js
- Express.js
- Multer (file handling)
- Session middleware

### Authentication
- ERP API Integration (`erp-snap-auth`)

### Media
- Local storage (uploads directory)
- Static file serving via Express

---

## Project Structure

```
UniConnect
│
├── app/                 # React Native client
│   ├── (tabs)/
│   │   ├── home.tsx
│   │   ├── profile.tsx
│   │   └── login.tsx
│   └── assets/
│
├── backend/             # Node.js API server
│   ├── server.mjs
│   ├── uploads/
│   └── package.json
│
└── README.md
```

---

## Local Setup

### Clone
```
git clone https://github.com/yourusername/uniconnect.git
cd uniconnect
```

### Backend
```
cd backend
npm install
node server.mjs
```

Server runs on:
```
http://YOUR_PC_IP:3000
```

---

### Mobile App
```
npm install
npx expo start
```

Open Expo Go and scan the QR code.

---

## Configuration

Set the backend IP inside the mobile app:

```js
const API_BASE = "http://YOUR_PC_IP:3000";
```

Example:
```js
const API_BASE = "http://192.168.1.5:3000";
```

Device and server must be on the same WiFi network during development.

---

## Security Model

- Verified ERP identity
- Protected routes
- Session-based access control
- No external account creation
- Closed network architecture

---

## Current Limitations

- In-memory storage
- Data resets on server restart
- No persistent database
- Single-node deployment

---

## Planned Enhancements

- MongoDB integration
- Likes & comments
- Follow system
- Push notifications
- Real-time messaging (WebSockets)
- Admin moderation panel
- Cloud deployment (AWS)

---

## Engineering Concepts Demonstrated

- Authentication integration with third-party service
- REST API design
- Session management
- Secure route protection
- Media upload pipelines
- Mobile-backend communication
- Stateful vs stateless architecture decisions

---

## Author

**Krishna Awasthi**  
B.Tech — Computer Science & Engineering (IoT)

---

## License

This project is developed for academic and educational use.
