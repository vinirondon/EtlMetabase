# ETLplatform v4.1

Plataforma de integração e ingestão de dados via API, Excel, CSV e Google Sheets.

## Stack
- **Frontend:** React + Vite + Tailwind — deploy na Vercel
- **Backend:** Node.js + Express — deploy no Railway
- **Banco:** PostgreSQL (Neon.tech recomendado)

## Desenvolvimento local

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend (novo terminal)
cd frontend && npm install && npm run dev
```

Acesse: http://localhost:5173
Login: admin@etlplatform.com / Admin@123456

## Deploy

### 1. Banco — Neon.tech (gratuito)
- Crie conta em neon.tech
- Crie um projeto e copie a connection string

### 2. Backend — Railway
- Importe o repositório no railway.app
- Root directory: `backend`
- Adicione as variáveis de ambiente do `.env.example`

### 3. Frontend — Vercel
- Importe o repositório na vercel.com
- Root directory: `frontend`
- Adicione: `VITE_API_URL=https://seu-backend.railway.app/api`
