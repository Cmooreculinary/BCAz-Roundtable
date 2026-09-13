"""Read-only SQLite checks before enabling unique indexes on an existing install.

Usage: python preflight.py --database /opt/data/roundtable_vo.sqlite3
Optional --backup writes a consistent SQLite snapshot to a new file. Uploads
must be backed up separately while writes are paused. No records are repaired
or deleted by this command, and duplicate values are never printed.
"""

import argparse
import json
import os
import sqlite3
from pathlib import Path

UNIQUE_KEYS = {
    "users": [("email",), ("id",)],
    "tables": [("id",)],
    "table_members": [("table_id", "user_id")],
    "invites": [("code",)],
    "push_subscriptions": [("endpoint",)],
    "call_logs": [("call_id",)],
    "table_seats": [("table_id", "seat_index"), ("table_id", "user_id")],
}


def inspect_database(database: Path, backup: Path | None = None) -> dict:
    database = database.resolve(strict=True)
    with sqlite3.connect(database.as_uri() + "?mode=ro", uri=True) as connection:
        integrity_ok = connection.execute("PRAGMA integrity_check").fetchall() == [("ok",)]
        conflicts = []
        for collection, indexes in UNIQUE_KEYS.items():
            for fields in indexes:
                expressions = [f"json_extract(document_json, '$.{field}')" for field in fields]
                group = ", ".join(["database_name", *expressions])
                present = " AND ".join(f"{expression} IS NOT NULL" for expression in expressions)
                count = connection.execute(
                    f"SELECT COUNT(*) FROM (SELECT COUNT(*) FROM documents WHERE collection_name=? AND {present} GROUP BY {group} HAVING COUNT(*) > 1)",
                    (collection,),
                ).fetchone()[0]
                if count:
                    conflicts.append(
                        {"collection": collection, "fields": fields, "duplicate_groups": count}
                    )
        if backup:
            descriptor = os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            os.close(descriptor)
            try:
                with sqlite3.connect(backup) as target:
                    connection.backup(target)
                    if target.execute("PRAGMA integrity_check").fetchall() != [("ok",)]:
                        raise RuntimeError("Backup integrity check failed")
            except Exception:
                backup.unlink(missing_ok=True)
                raise
    return {
        "integrity_ok": integrity_ok,
        "unique_index_conflicts": conflicts,
        "ready_for_indexes": integrity_ok and not conflicts,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", type=Path, required=True)
    parser.add_argument("--backup", type=Path)
    args = parser.parse_args()
    try:
        result = inspect_database(args.database, args.backup)
    except (OSError, sqlite3.Error, RuntimeError) as error:
        print(json.dumps({"ready_for_indexes": False, "error": type(error).__name__}))
        return 1
    print(json.dumps(result, indent=2))
    return 0 if result["ready_for_indexes"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
