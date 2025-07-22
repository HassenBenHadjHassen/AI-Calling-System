# AI Calling System Backend

MVP backend for AI-powered calling platform with French phone numbers, Vapi.ai integration, and automated prospect management.

## 🚀 Features

- **Lead Management**: Upload via Excel/CSV or JSON API
- **Campaign Control**: Start/stop calling campaigns
- **AI Calling**: Vapi.ai integration with French conversations
- **Authentication**: JWT-based secure access
- **File Upload**: Excel (.xlsx, .xls) and CSV support
- **GDPR Compliance**: Built-in data protection
- **Real-time Webhooks**: Live call status updates

## 🛠 Tech Stack

- Node.js + Express + TypeScript
- MongoDB + Prisma ORM
- Vapi.ai SDK + Twilio
- JWT Authentication
- File processing (XLSX)

## ⚡ Quick Start

1. **Install dependencies:**
```bash
npm install
# or
pnpm install
```

2. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your API keys
```

3. **Setup database:**
```bash
npx prisma generate
npx prisma db push
```

4. **Start server:**
```bash
npm run dev
```

Server starts at `http://localhost:4000`

## 🔑 Environment Variables

```env
DATABASE_URL=mongodb://localhost:27017/ai-calling-system
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_FROM_NUMBER=+33xxxxxxxxx
VAPI_API_KEY=your_vapi_key
JWT_SECRET=your-secret-key
```

## 📚 API Endpoints

### Authentication
```http
POST /api/auth/login
{
  "email": "admin@example.com",
  "password": "admin123"
}
```

### Lead Management
```http
# Upload JSON
POST /api/leads/upload
Authorization: Bearer <token>

# Upload File
POST /api/leads/upload/file
Content-Type: multipart/form-data

# List with pagination
GET /api/leads?page=1&limit=50&status=NEW

# Get statistics
GET /api/leads/stats
```

### Call Management
```http
# Trigger call
POST /api/calls/trigger
{
  "leadId": "id",
  "phoneNumber": "+33123456789"
}

# Webhook (for Vapi.ai)
POST /api/calls/webhook
```

## 📊 Database Models

**Lead**: phone, name, email, status (NEW/CALLED/INTERESTED/TRANSFERRED/FAILED)
**Campaign**: name, status (RUNNING/STOPPED), leads
**CallHistory**: lead, campaign, status, timestamps, transfer info

## 🔒 Security Features

- JWT authentication on all endpoints
- File upload validation (5MB limit)
- French phone number validation
- GDPR-compliant AI scripts
- Environment variable validation

## 🚀 Development

```bash
npm run dev          # Start with nodemon
npm run build        # Build TypeScript
npm run lint         # Run ESLint
npm run db:generate  # Generate Prisma client
npm run db:studio    # Open Prisma Studio
```

## 📁 Project Structure

```
src/
├── config/          # Environment validation
├── controllers/     # Request handlers
├── middleware/      # Auth & file upload
├── repositories/    # Data access layer
├── routes/          # API routes
├── services/        # Business logic
└── app.ts           # Express setup
```

## 🐛 Troubleshooting

1. **Missing dependencies**: Run `npm install`
2. **Prisma errors**: Run `npx prisma generate`
3. **Auth issues**: Check JWT_SECRET in .env
4. **File upload**: Ensure uploads/ directory exists
5. **Vapi.ai**: Verify API key and French phone numbers

## 📞 Support

Check error logs, verify .env configuration, and ensure all dependencies are installed.
