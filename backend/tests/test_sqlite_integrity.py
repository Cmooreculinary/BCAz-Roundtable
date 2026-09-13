import asyncio
import sqlite3

import pytest

from sqlite_store import AsyncSQLiteClient
from preflight import inspect_database


def test_unique_indexes_and_atomic_updates_survive_concurrency(tmp_path):
    client = AsyncSQLiteClient(str(tmp_path / "integrity.sqlite3"))

    async def exercise():
        users = client["test"].users
        await users.create_index("email", unique=True)
        await users.insert_one({"id": "one", "email": "one@example.com", "count": 0})
        with pytest.raises(sqlite3.IntegrityError):
            await users.insert_one({"id": "two", "email": "one@example.com"})
        with pytest.raises(sqlite3.IntegrityError):
            await users.insert_one({"id": "one", "email": "replacement@example.com"})
        await asyncio.gather(
            *(users.update_one({"id": "one"}, {"$inc": {"count": 1}}) for _ in range(100))
        )
        assert (await users.find_one({"id": "one"}))["count"] == 100
        seats = client["test"].seats
        await seats.create_index([("table_id", 1), ("seat_index", 1)], unique=True)
        await seats.create_index([("table_id", 1), ("user_id", 1)], unique=True)
        await seats.insert_one({"table_id": "table", "seat_index": 0, "user_id": "one"})
        await seats.insert_one({"table_id": "table", "seat_index": 1, "user_id": "two"})
        with pytest.raises(sqlite3.IntegrityError):
            await seats.update_one({"user_id": "one"}, {"$set": {"seat_index": 1}})
        assert (await seats.find_one({"user_id": "one"}))["seat_index"] == 0
        await asyncio.gather(
            *(
                seats.update_one(
                    {"table_id": "other", "user_id": "one"},
                    {"$set": {"seat_index": 0}},
                    upsert=True,
                )
                for _ in range(20)
            )
        )
        assert await seats.count_documents({"table_id": "other"}) == 1

    try:
        asyncio.run(exercise())
    finally:
        client.close()


def test_preflight_detects_legacy_duplicates_without_deleting_records(tmp_path):
    path = tmp_path / "legacy.sqlite3"
    client = AsyncSQLiteClient(str(path))

    async def seed():
        await client["legacy"].users.insert_one({"id": "one", "email": "duplicate@example.com"})
        await client["legacy"].users.insert_one({"id": "two", "email": "duplicate@example.com"})

    asyncio.run(seed())
    client.close()
    backup = tmp_path / "snapshot.sqlite3"
    result = inspect_database(path, backup)
    assert result["integrity_ok"]
    assert not result["ready_for_indexes"]
    assert result["unique_index_conflicts"] == [
        {"collection": "users", "fields": ("email",), "duplicate_groups": 1}
    ]
    assert inspect_database(backup) == result
    with pytest.raises(FileExistsError):
        inspect_database(path, backup)
