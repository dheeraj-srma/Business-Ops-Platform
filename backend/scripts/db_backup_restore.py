# backend/scripts/db_backup_restore.py
"""
Database Backup and Restore Utility Script for Nalka Metals ERP.
Provides CLI commands to export relational database tables to JSON backups
and restore state if needed.
"""
import os
import sys
import json
import argparse
from datetime import datetime, timezone
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

try:
    from supabase_client import get_supabase_client
except Exception as e:
    get_supabase_client = None

TABLES_TO_BACKUP = [
    "products",
    "inventory",
    "transactions",
    "orders",
    "order_items",
    "dealers",
    "locations",
    "suppliers",
    "audit_logs",
    "tally_sync_logs",
]

def backup_database(output_path: str = None) -> str:
    """Exports all configured tables to a timestamped JSON file."""
    if not get_supabase_client:
        raise RuntimeError("Supabase client is not available. Check environment variables.")

    client = get_supabase_client()
    backup_data = {
        "metadata": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "tables": TABLES_TO_BACKUP,
        },
        "tables": {}
    }

    print("Starting database backup...")
    for table_name in TABLES_TO_BACKUP:
        try:
            offset = 0
            rows = []
            while True:
                res = client.table(table_name).select("*").range(offset, offset + 999).execute()
                batch = res.data or []
                if not batch:
                    break
                rows.extend(batch)
                if len(batch) < 1000:
                    break
                offset += 1000
            backup_data["tables"][table_name] = rows
            print(f"  [+] Dumped table '{table_name}': {len(rows)} records")
        except Exception as err:
            print(f"  [-] Failed to dump table '{table_name}': {err}")
            backup_data["tables"][table_name] = []

    if not output_path:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_dir = Path(__file__).resolve().parent.parent / "backups"
        backup_dir.mkdir(exist_ok=True)
        output_path = str(backup_dir / f"db_backup_{ts}.json")

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(backup_data, f, indent=2, default=str)

    print(f"Backup completed successfully -> {output_path}")
    return output_path


def restore_database(input_path: str, dry_run: bool = False) -> bool:
    """Restores tables from a JSON backup file."""
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Backup file not found at '{input_path}'")

    if not get_supabase_client:
        raise RuntimeError("Supabase client is not available. Check environment variables.")

    with open(input_path, "r", encoding="utf-8") as f:
        backup_data = json.load(f)

    meta = backup_data.get("metadata", {})
    tables_data = backup_data.get("tables", {})
    print(f"Starting database restore from timestamp: {meta.get('timestamp')}")
    if dry_run:
        print("DRY RUN MODE ENABLED - No changes will be written to DB.")

    client = get_supabase_client()
    for table_name, rows in tables_data.items():
        print(f"  [*] Table '{table_name}': {len(rows)} records in backup")
        if dry_run or not rows:
            continue

        try:
            # Upsert batch of rows
            batch_size = 500
            for i in range(0, len(rows), batch_size):
                batch = rows[i:i + batch_size]
                client.table(table_name).upsert(batch).execute()
            print(f"  [+] Upserted {len(rows)} records into '{table_name}'")
        except Exception as err:
            print(f"  [-] Failed to restore '{table_name}': {err}")

    print("Restore operation finished.")
    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Nalka Metals ERP DB Backup & Restore Tool")
    subparsers = parser.add_subparsers(dest="command", help="Sub-commands")

    backup_parser = subparsers.add_parser("backup", help="Create a JSON snapshot of the DB")
    backup_parser.add_argument("--out", type=str, help="Output file path (optional)")

    restore_parser = subparsers.add_parser("restore", help="Restore DB from a JSON snapshot")
    restore_parser.add_argument("--file", type=str, required=True, help="Input backup JSON file path")
    restore_parser.add_argument("--dry-run", action="store_true", help="Simulate restore without inserting")

    args = parser.parse_args()

    if args.command == "backup":
        backup_database(output_path=args.out)
    elif args.command == "restore":
        restore_database(input_path=args.file, dry_run=args.dry_run)
    else:
        parser.print_help()
