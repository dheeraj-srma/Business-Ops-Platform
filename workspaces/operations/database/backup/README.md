# 🏛️ Nalka Metals - Golden Database Backup & Migration Architecture

This directory houses the **developer-owned golden database backup, restore, and versioned migration suite** for the Nalka Metals application.

---

## 📂 Database Directory Structure

```
database/
├── backup/
│   ├── backup.bat           # Windows 3-part backup script (roles, schema, data)
│   ├── restore.bat          # Windows 3-part restore script
│   └── README.md            # This architecture guide
├── migrations/
│   ├── 001_extensions_and_roles.sql
│   ├── 002_user_profiles.sql
│   ├── 003_inventory.sql
│   ├── 004_pending_orders.sql
│   ├── 005_system_settings.sql
│   ├── 006_rpc_submit_order.sql
│   └── 007_views_and_policies.sql
└── snapshots/               # Local snapshot storage (gitignored for data security)
    └── nalka-database-backup/
        ├── 01_roles.sql
        ├── 02_schema.sql
        └── 03_data.sql
```

---

## ⚙️ Three-Part Backup Pattern

Supabase officially recommends splitting logical backups into 3 distinct SQL layers:

1. **`01_roles.sql`**: Custom roles, grants, and permission definitions.
2. **`02_schema.sql`**: Database structure, including tables, views, security definer functions, triggers, indexes, constraints, and RLS policies.
3. **`03_data.sql`**: All table data records using bulk `COPY` / `INSERT` statements.

---

## 🚀 How to Execute Backup & Restore

### Option A: Interactive Batch Scripts (`.bat`)
Run `backup.bat` or `restore.bat` from File Explorer or command prompt.

### Option B: Automated Python CLI (Works out-of-the-box on Windows/Linux/Mac without extra tools)
```bash
# Export 3-part + full dump backup
npm run db:backup

# Restore backup to any PostgreSQL / Supabase target URL
npm run db:restore

# Direct live 1-command migration (Source DB -> Target DB)
npm run db:migrate
```

### Option C: Frontend UI Button
Click the **`Backup DB`** button in the app header or open the Database Maintenance tab under Settings to export SQL files directly to your browser.
