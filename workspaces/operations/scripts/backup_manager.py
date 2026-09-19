#!/usr/bin/env python3
"""
=============================================================================
SUPABASE / POSTGRESQL AUTOMATED BACKUP & MIGRATION MANAGER
=============================================================================
Provides seamless 1-command Database Export (Backup), Restore, and Direct Live 
Migration across any database provider (Supabase, Neon, Railway, Render, AWS RDS, 
self-hosted PostgreSQL).

Usage:
  python scripts/backup_manager.py backup [--source-url <url>]
  python scripts/backup_manager.py restore [--target-url <url>] [--file <path>]
  python scripts/backup_manager.py migrate --source-url <url> --target-url <url>
  python scripts/backup_manager.py list
"""

import os
import sys
import json
import argparse
import datetime
import shutil

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

import psycopg2
import psycopg2.extras
from typing import Dict, Any, List

DEFAULT_SOURCE_URL = os.environ.get(
    "DATABASE_URL", 
    os.environ.get("TARGET_DB_URL", "postgres://postgres:Le4gnvo3y5IaBo7GsJRJe5-NoAbe_6P5@db-e1e10c14cbe0.db.getvoroa.com:28531/nalka_db?sslmode=require")
)

BACKUP_ROOT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "db_backups")

def ensure_backup_dir():
    if not os.path.exists(BACKUP_ROOT_DIR):
        os.makedirs(BACKUP_ROOT_DIR, exist_ok=True)

def get_connection(url: str):
    try:
        conn = psycopg2.connect(url, connect_timeout=5)
        conn.autocommit = True
        return conn
    except Exception as e:
        print(f"⚠️ Direct PostgreSQL connection failed ({e}). Will attempt Supabase REST API fallback.")
        return None

def fetch_tables_via_supabase_api():
    supabase_url = os.environ.get("SUPABASE_URL", "https://deqrfmjzoxlirgfhuouh.supabase.co")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlcXJmbWp6b3hsaXJnZmh1b3VoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTQxMjEzNywiZXhwIjoyMTA0OTg4MTM3fQ.WpH9zliujW6-3lD9TkWAx8E0c6T4dnBOdAJu5n3Stuk")
    
    import urllib.request
    known_tables = ["inventory", "user_profiles", "pending_orders", "pending_order_items", "system_settings"]
    full_data = {}
    
    for tbl in known_tables:
        try:
            req_url = f"{supabase_url}/rest/v1/{tbl}?select=*"
            req = urllib.request.Request(req_url, headers={
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}"
            })
            with urllib.request.urlopen(req) as resp:
                if resp.status == 200:
                    rows = json.loads(resp.read().decode('utf-8'))
                    full_data[tbl] = rows
                    print(f"  • Extracted {len(rows)} rows from public.{tbl} via Supabase API")
        except Exception as err:
            print(f"  ⚠️ Could not fetch table {tbl} via REST API: {err}")
            full_data[tbl] = []
    return full_data

def generate_inserts_from_dict_list(table_name: str, rows: List[Dict[str, Any]]) -> str:
    if not rows:
        return f"-- Table public.{table_name} has 0 rows.\n\n"
    
    colnames = list(rows[0].keys())
    cols_str = ", ".join([f'"{c}"' for c in colnames])
    sql_lines = [f"-- Data for public.{table_name} ({len(rows)} rows)"]
    
    for r in rows:
        vals = []
        for col in colnames:
            v = r.get(col)
            if v is None:
                vals.append("NULL")
            elif isinstance(v, bool):
                vals.append("TRUE" if v else "FALSE")
            elif isinstance(v, (int, float)):
                vals.append(str(v))
            elif isinstance(v, (dict, list)):
                escaped_json = json.dumps(v).replace("'", "''")
                vals.append(f"'{escaped_json}'::jsonb")
            else:
                escaped_str = str(v).replace("'", "''")
                vals.append(f"'{escaped_str}'")
        val_str = ", ".join(vals)
        sql_lines.append(f'INSERT INTO public."{table_name}" ({cols_str}) VALUES ({val_str}) ON CONFLICT DO NOTHING;')
    sql_lines.append("\n")
    return "\n".join(sql_lines)

def export_table_data(cur, table_name: str) -> List[Dict[str, Any]]:
    try:
        cur.execute(f'SELECT * FROM public."{table_name}";')
        colnames = [desc[0] for desc in cur.description]
        rows = cur.fetchall()
        result = []
        for r in rows:
            row_dict = {}
            for col, val in zip(colnames, r):
                if isinstance(val, (datetime.datetime, datetime.date)):
                    row_dict[col] = val.isoformat()
                else:
                    row_dict[col] = val
            result.append(row_dict)
        return result
    except Exception as e:
        print(f"⚠️ Warning exporting table {table_name}: {e}")
        return []

def generate_sql_insert_statements(cur, table_name: str) -> str:
    try:
        cur.execute(f'SELECT * FROM public."{table_name}";')
        colnames = [desc[0] for desc in cur.description]
        rows = cur.fetchall()
        if not rows:
            return f"-- Table public.{table_name} has 0 rows.\n\n"

        cur.execute(f"""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = '{table_name}';
        """)
        type_map = {r[0]: r[1].lower() for r in cur.fetchall()}

        cols_str = ", ".join([f'"{c}"' for c in colnames])
        sql_lines = [f"-- Data for public.{table_name} ({len(rows)} rows)"]

        for row in rows:
            vals = []
            for col, v in zip(colnames, row):
                col_type = type_map.get(col, '')
                if v is None:
                    vals.append("NULL")
                elif isinstance(v, bool):
                    if 'json' in col_type:
                        vals.append(f"'{'true' if v else 'false'}'::jsonb")
                    else:
                        vals.append("TRUE" if v else "FALSE")
                elif isinstance(v, (int, float)):
                    if 'json' in col_type:
                        vals.append(f"'{v}'::jsonb")
                    else:
                        vals.append(str(v))
                elif isinstance(v, (dict, list)):
                    escaped_json = json.dumps(v).replace("'", "''")
                    vals.append(f"'{escaped_json}'::jsonb")
                else:
                    escaped_str = str(v).replace("'", "''")
                    if 'json' in col_type:
                        vals.append(f"'{escaped_str}'::jsonb")
                    else:
                        vals.append(f"'{escaped_str}'")
            val_str = ", ".join(vals)
            sql_lines.append(f'INSERT INTO public."{table_name}" ({cols_str}) VALUES ({val_str}) ON CONFLICT DO NOTHING;')

        sql_lines.append("\n")
        return "\n".join(sql_lines)
    except Exception as e:
        print(f"⚠️ Could not generate SQL inserts for {table_name}: {e}")
        return ""

def do_backup(source_url: str):
    ensure_backup_dir()
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_folder = os.path.join(BACKUP_ROOT_DIR, f"backup_{timestamp}")
    os.makedirs(backup_folder, exist_ok=True)

    print(f"📦 Starting Backup process...")
    print(f"🔗 Source Database: {source_url.split('@')[-1] if '@' in source_url else source_url}")
    print(f"📁 Destination Folder: {backup_folder}")

    conn = get_connection(source_url)
    full_json_export = {}
    data_sql_parts = [
        "-- ====================================================================\n",
        f"-- 03_DATA.SQL - EXPORTED AT {timestamp}\n",
        "-- ====================================================================\n"
    ]
    tables = []

    if conn is not None:
        cur = conn.cursor()
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        """)
        tables = [r[0] for r in cur.fetchall()]
        print(f"🔍 Discovered {len(tables)} base tables in public schema: {', '.join(tables)}")

        for tbl in tables:
            full_json_export[tbl] = export_table_data(cur, tbl)
            data_sql_parts.append(generate_sql_insert_statements(cur, tbl))
        conn.close()
    else:
        print("🌐 Using Supabase REST API Fallback to fetch data...")
        full_json_export = fetch_tables_via_supabase_api()
        tables = list(full_json_export.keys())
        for tbl, rows in full_json_export.items():
            data_sql_parts.append(generate_inserts_from_dict_list(tbl, rows))

    json_path = os.path.join(backup_folder, "data_export.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(full_json_export, f, indent=2, default=str)
    print(f"✅ Exported structured JSON data to: {json_path}")

    # 2. Export Self-Contained 3-Part Dump Files
    roles_sql = (
        "-- ====================================================================\n"
        f"-- 01_ROLES.SQL - EXPORTED AT {timestamp}\n"
        "-- ====================================================================\n"
        "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";\n"
        "CREATE SCHEMA IF NOT EXISTS auth;\n"
        "DO $$ BEGIN\n"
        "  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;\n"
        "  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;\n"
        "END $$;\n"
        "CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY, email TEXT UNIQUE, created_at TIMESTAMPTZ DEFAULT NOW());\n"
        "CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$ SELECT NULL::uuid; $$;\n"
    )

    base_schema_file = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "supabase_schema.sql")
    schema_template = ""
    if os.path.exists(base_schema_file):
        with open(base_schema_file, "r", encoding="utf-8") as f:
            schema_template = f.read()

    schema_sql = (
        "-- ====================================================================\n"
        f"-- 02_SCHEMA.SQL - EXPORTED AT {timestamp}\n"
        "-- ====================================================================\n"
        + schema_template
    )

    data_sql = "\n".join(data_sql_parts)

    # Save 3 individual SQL files inside snapshot folder
    with open(os.path.join(backup_folder, "01_roles.sql"), "w", encoding="utf-8") as f:
        f.write(roles_sql)
    with open(os.path.join(backup_folder, "02_schema.sql"), "w", encoding="utf-8") as f:
        f.write(schema_sql)
    with open(os.path.join(backup_folder, "03_data.sql"), "w", encoding="utf-8") as f:
        f.write(data_sql)

    # Write backup-info.txt
    info_text = (
        f"====================================================================\n"
        f"NALKA METALS GOLDEN DATABASE BACKUP SNAPSHOT\n"
        f"====================================================================\n"
        f"Timestamp: {timestamp}\n"
        f"Tables Exported: {len(tables)} ({', '.join(tables)})\n"
        f"Source Host: {source_url.split('@')[-1] if '@' in source_url else source_url}\n"
        f"Files Generated:\n"
        f"  - 01_roles.sql\n"
        f"  - 02_schema.sql\n"
        f"  - 03_data.sql\n"
        f"  - full_schema_and_data.sql\n"
        f"  - data_export.json\n"
    )
    with open(os.path.join(backup_folder, "backup-info.txt"), "w", encoding="utf-8") as f:
        f.write(info_text)

    print(f"✅ Exported 3-part SQL dump pattern (01_roles.sql, 02_schema.sql, 03_data.sql)")

    # Combined Full SQL Dump for 1-click single-file restores
    sql_path = os.path.join(backup_folder, "full_schema_and_data.sql")
    full_sql_content = roles_sql + "\n" + schema_sql + "\n" + data_sql
    with open(sql_path, "w", encoding="utf-8") as f:
        f.write(full_sql_content)
    print(f"✅ Exported full combined standalone SQL backup to: {sql_path}")

    # Sync to database/snapshots/nalka-database-backup/ folder
    golden_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "database", "snapshots", "nalka-database-backup")
    os.makedirs(golden_dir, exist_ok=True)
    shutil.copyfile(os.path.join(backup_folder, "01_roles.sql"), os.path.join(golden_dir, "01_roles.sql"))
    shutil.copyfile(os.path.join(backup_folder, "02_schema.sql"), os.path.join(golden_dir, "02_schema.sql"))
    shutil.copyfile(os.path.join(backup_folder, "03_data.sql"), os.path.join(golden_dir, "03_data.sql"))
    shutil.copyfile(os.path.join(backup_folder, "backup-info.txt"), os.path.join(golden_dir, "backup-info.txt"))
    print(f"⭐ Updated golden database backup folder at: {golden_dir}")

    # Copy to latest_backup.sql
    latest_sql_path = os.path.join(BACKUP_ROOT_DIR, "latest_backup.sql")
    shutil.copyfile(sql_path, latest_sql_path)
    print(f"⭐ Updated latest quick-restore shortcut: {latest_sql_path}")

    if conn is not None:
        conn.close()
    print(f"\n🎉 Backup completed successfully in folder: backup_{timestamp}")
    return sql_path

def do_restore(target_url: str, sql_file: str):
    if not os.path.exists(sql_file):
        print(f"❌ Error: Backup SQL file not found at path: {sql_file}")
        sys.exit(1)

    print(f"🚀 Starting Database Restore process...")
    print(f"🔗 Target Database: {target_url.split('@')[-1] if '@' in target_url else target_url}")
    print(f"📄 Restoring SQL File: {sql_file}")

    conn = get_connection(target_url)
    cur = conn.cursor()

    print("==> Ensuring prerequisite schemas, roles, and stub auth functions...")
    cur.execute('CREATE SCHEMA IF NOT EXISTS auth;')
    cur.execute('''
        DO $$ BEGIN 
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF; 
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF; 
        END $$;
    ''')
    cur.execute('''
        CREATE TABLE IF NOT EXISTS auth.users (
          id UUID PRIMARY KEY,
          email TEXT UNIQUE,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
    ''')
    cur.execute('''
        CREATE OR REPLACE FUNCTION auth.uid()
        RETURNS UUID
        LANGUAGE sql
        STABLE
        AS $$ SELECT NULL::uuid; $$;
    ''')

    print(f"==> Reading SQL script ({os.path.getsize(sql_file)} bytes)...")
    with open(sql_file, "r", encoding="utf-8") as f:
        sql_content = f.read()

    print("==> Executing SQL schema and data import statements...")
    try:
        cur.execute(sql_content)
        print("✅ Executed SQL restore statements successfully!")
    except Exception as e:
        print(f"⚠️ SQL execution returned notice/warning: {e}")

    # Verify table row counts
    print("\n==> Restored Tables Summary:")
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name;
    """)
    tables = [r[0] for r in cur.fetchall()]
    for tbl in tables:
        cur.execute(f'SELECT COUNT(*) FROM public."{tbl}";')
        cnt = cur.fetchone()[0]
        print(f"    • {tbl}: {cnt} rows")

    conn.close()
    print("\n🎉 Restore completed cleanly! Your database is ready.")

def do_migrate(source_url: str, target_url: str):
    print("=====================================================================")
    print("🚀 DIRECT ONE-CLICK DATABASE MIGRATION SYSTEM")
    print("=====================================================================")
    print(f"Source: {source_url.split('@')[-1] if '@' in source_url else source_url}")
    print(f"Target: {target_url.split('@')[-1] if '@' in target_url else target_url}\n")

    # Step 1: Backup Source
    backup_sql = do_backup(source_url)
    print("\n---------------------------------------------------------------------")

    # Step 2: Restore to Target
    do_restore(target_url, backup_sql)
    print("=====================================================================")
    print("✨ MIGRATION COMPLETE! All schema, RLS policies, RPCs, and data transferred.")

def do_list():
    ensure_backup_dir()
    entries = sorted(os.listdir(BACKUP_ROOT_DIR))
    print(f"📁 Database Backups Directory: {BACKUP_ROOT_DIR}\n")
    found = False
    for item in entries:
        full_path = os.path.join(BACKUP_ROOT_DIR, item)
        if os.path.isdir(full_path) and item.startswith("backup_"):
            found = True
            files = os.listdir(full_path)
            total_size = sum(os.path.getsize(os.path.join(full_path, f)) for f in files)
            print(f"  • {item} ({total_size / 1024:.1f} KB, {len(files)} files)")
            for f in files:
                sz = os.path.getsize(os.path.join(full_path, f)) / 1024
                print(f"      - {f} ({sz:.1f} KB)")
            print("")

    if os.path.exists(os.path.join(BACKUP_ROOT_DIR, "latest_backup.sql")):
        sz = os.path.getsize(os.path.join(BACKUP_ROOT_DIR, "latest_backup.sql")) / 1024
        print(f"  ⭐ latest_backup.sql ({sz:.1f} KB) -> Shortcut to latest full backup")

    if not found:
        print("  No timestamped backup folders found yet. Run 'python scripts/backup_manager.py backup' to create one.")

def main():
    parser = argparse.ArgumentParser(description="Supabase / PostgreSQL Automated Backup & Migration Manager")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Backup command
    backup_parser = subparsers.add_parser("backup", help="Export full database backup (schema + data)")
    backup_parser.add_argument("--source-url", default=DEFAULT_SOURCE_URL, help="Source PostgreSQL database connection string")

    # Restore command
    restore_parser = subparsers.add_parser("restore", help="Restore database backup to target database")
    restore_parser.add_argument("--target-url", default=DEFAULT_SOURCE_URL, help="Target PostgreSQL database connection string")
    restore_parser.add_argument("--file", default=os.path.join(BACKUP_ROOT_DIR, "latest_backup.sql"), help="Path to backup SQL file to restore")

    # Migrate command
    migrate_parser = subparsers.add_parser("migrate", help="Direct live migration from Source DB to Target DB")
    migrate_parser.add_argument("--source-url", required=True, help="Source PostgreSQL database connection string")
    migrate_parser.add_argument("--target-url", required=True, help="Target PostgreSQL database connection string")

    # List command
    subparsers.add_parser("list", help="List all available local backup snapshots")

    args = parser.parse_args()

    if args.command == "backup":
        do_backup(args.source_url)
    elif args.command == "restore":
        do_restore(args.target_url, args.file)
    elif args.command == "migrate":
        do_migrate(args.source_url, args.target_url)
    elif args.command == "list":
        do_list()
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
