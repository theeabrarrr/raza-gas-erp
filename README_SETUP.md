# Raza Gas ERP - Setup Guide

## 1. Prerequisites
- Node.js (v18+)
- npm or pnpm

## 2. Installation

Clone the repository and install dependencies:

```bash
git clone <repository_url>
cd raza-gas-erp
npm install
```

## 3. Environment Configuration

Create a file named `.env.local` in the root directory.
Add your Supabase credentials (found in Supabase Dashboard -> Settings -> API):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## 4. Running the Project

Start the development server:

```bash
npm run dev
```

Visit `http://localhost:3000` to see the application.

## 5. Database Schema

Ensure your Supabase project has the following migrations applied:
1. `users` table linked to `auth.users`.
2. `employee_wallets` table.
3. `orders`, `customers`, `inventory`, `handover_logs` tables.
4. RLS policies enabled for security.

## Troubleshooting

- **Login Error**: If you see "Database error querying schema", ensure you have run `migration_final_schema_fix.sql` in the Supabase SQL Editor.
- **Middleware Warning**: Ignorable in dev mode if functionality works.
