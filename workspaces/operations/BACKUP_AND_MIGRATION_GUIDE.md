# 🛡️ Supabase & PostgreSQL Automated Backup & Migration Guide

This repository includes a **zero-hassle, automated backup & migration system**. It allows you to take complete backups of your database (schemas, tables, functions, RLS policies, RPCs, views, and data) and transfer/migrate them to **any database provider** (Supabase, Neon, Railway, Render, AWS RDS, DigitalOcean, or self-hosted PostgreSQL) in **1 single command**.

---

## 🚀 Quick Reference Commands

| Task | Command |
| :--- | :--- |
| **Backup Current DB** | `npm run db:backup` |
| **List Available Backups** | `npm run db:list` |
| **Restore to Target DB** | `python scripts/backup_manager.py restore --target-url "<TARGET-CONNECTION-URI>"` |
| **Direct Live Migration** | `python scripts/backup_manager.py migrate --source-url "<SOURCE-URI>" --target-url "<TARGET-URI>"` |

---

## 📦 How to Create a Backup

To export a full snapshot of your database (both SQL dump and JSON export):

```bash
npm run db:backup
```

*(Or specify a custom database connection URI)*:
```bash
python scripts/backup_manager.py backup --source-url "postgres://postgres:PASSWORD@HOST:PORT/DATABASE"
```

### What this creates:
Inside the `db_backups/` directory:
- `db_backups/backup_YYYYMMDD_HHMMSS/full_schema_and_data.sql`: Standalone, executable SQL file with schema, extensions, tables, RLS policies, functions (`submit_order`), and insert statements for all data.
- `db_backups/backup_YYYYMMDD_HHMMSS/data_export.json`: Clean structured JSON data export.
- `db_backups/latest_backup.sql`: Convenient shortcut pointing to your latest full backup.

---

## 🔄 How to Transfer / Restore to Another Provider

If you create a new database on **Supabase**, **Neon**, **Railway**, **Render**, **AWS RDS**, or any other provider:

### Step 1: Get the Target PostgreSQL Connection String
Copy the connection string (URI) from your new provider's dashboard.
*Example*:
`postgres://postgres:MyPassword123@db-abc123.db.getvoroa.com:5432/postgres?sslmode=require`

### Step 2: Run Restore Command
To restore your latest backup into the new database:

```bash
python scripts/backup_manager.py restore --target-url "postgres://postgres:MyPassword123@db-abc123.db.getvoroa.com:5432/postgres?sslmode=require"
```

To restore a specific backup file:
```bash
python scripts/backup_manager.py restore --target-url "<TARGET-CONNECTION-URI>" --file "db_backups/backup_20260917_170734/full_schema_and_data.sql"
```

### What the Restore command automatically handles:
1. Enables extensions (`uuid-ossp`).
2. Creates prerequisite `auth` schema, `auth.users` stub table, and `auth.uid()` function.
3. Sets up RLS roles (`authenticated`, `anon`).
4. Creates all tables, primary keys, indexes, foreign keys, and constraints.
5. Populates all data (`inventory`, `user_profiles`, `pending_orders`, `pending_order_items`, `system_settings`).
6. Installs authoritative RPC functions (`submit_order`), security functions, views (`orders`, `order_items`), and RLS policies.
7. Prints a row-count summary verifying all restored tables.

---

## ⚡ 1-Click Direct Live Migration (Source DB → Target DB)

To copy everything directly from your current database to a brand new database without saving intermediate files:

```bash
python scripts/backup_manager.py migrate --source-url "<OLD-DB-CONNECTION-URI>" --target-url "<NEW-DB-CONNECTION-URI>"
```

---

## ⚙️ Updating App Credentials After Migration

Once your new database is restored and active:

1. Update your `.env` file to point to the new provider credentials:
```env
VITE_PUBLIC_SUPABASE_URL=https://<YOUR-NEW-PROJECT-REF>.supabase.co
VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<YOUR-NEW-ANON-KEY>
VITE_SUPABASE_SECRET_KEY=<YOUR-NEW-SERVICE-ROLE-KEY>
```

2. Restart your development dev server:
```bash
npm run dev
```

---

## 🔒 Security Best Practice
The `db_backups/` directory is listed in `.gitignore` to prevent sensitive database dumps from being committed into public Git repositories.
