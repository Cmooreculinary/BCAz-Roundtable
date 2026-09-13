from __future__ import annotations

import asyncio
import copy
import json
import re
import sqlite3
import threading
import uuid
import hashlib
from dataclasses import dataclass
from datetime import date, datetime, time, timezone
from pathlib import Path
from typing import Any


_MISSING = object()


@dataclass
class InsertOneResult:
    inserted_id: str


@dataclass
class InsertManyResult:
    inserted_ids: list[str]


@dataclass
class UpdateResult:
    matched_count: int = 0
    modified_count: int = 0
    upserted_id: str | None = None


@dataclass
class DeleteResult:
    deleted_count: int = 0


def _to_jsonable(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, (date, time)):
        return value.isoformat()
    if isinstance(value, set):
        return [_to_jsonable(item) for item in value]
    if isinstance(value, list):
        return [_to_jsonable(item) for item in value]
    if isinstance(value, tuple):
        return [_to_jsonable(item) for item in value]
    if isinstance(value, dict):
        return {str(key): _to_jsonable(item) for key, item in value.items()}
    return value


def _clone_document(document: dict[str, Any]) -> dict[str, Any]:
    return copy.deepcopy(_to_jsonable(document))


def _get_nested(document: dict[str, Any], dotted_key: str) -> Any:
    current: Any = document
    for part in dotted_key.split("."):
        if not isinstance(current, dict) or part not in current:
            return _MISSING
        current = current[part]
    return current


def _set_nested(document: dict[str, Any], dotted_key: str, value: Any) -> None:
    current = document
    parts = dotted_key.split(".")
    for part in parts[:-1]:
        next_value = current.get(part)
        if not isinstance(next_value, dict):
            next_value = {}
            current[part] = next_value
        current = next_value
    current[parts[-1]] = _to_jsonable(value)


def _unset_nested(document: dict[str, Any], dotted_key: str) -> None:
    current = document
    parts = dotted_key.split(".")
    for part in parts[:-1]:
        next_value = current.get(part)
        if not isinstance(next_value, dict):
            return
        current = next_value
    current.pop(parts[-1], None)


def _values_equal(actual: Any, expected: Any) -> bool:
    expected = _to_jsonable(expected)
    if actual is _MISSING:
        return False
    if isinstance(actual, list) and not isinstance(expected, list):
        return expected in actual
    return actual == expected


def _compare(actual: Any, expected: Any, operator: str) -> bool:
    if actual is _MISSING:
        return False
    expected = _to_jsonable(expected)
    try:
        if operator == "$gt":
            return actual > expected
        if operator == "$gte":
            return actual >= expected
        if operator == "$lt":
            return actual < expected
        if operator == "$lte":
            return actual <= expected
    except TypeError:
        actual_text = str(actual)
        expected_text = str(expected)
        if operator == "$gt":
            return actual_text > expected_text
        if operator == "$gte":
            return actual_text >= expected_text
        if operator == "$lt":
            return actual_text < expected_text
        if operator == "$lte":
            return actual_text <= expected_text
    return False


def _match_operator(actual: Any, operator: str, expected: Any, found: bool) -> bool:
    if operator == "$exists":
        return found is bool(expected)
    if operator == "$ne":
        return not _values_equal(actual, expected)
    if operator == "$in":
        expected_values = [_to_jsonable(item) for item in expected]
        if actual is _MISSING:
            return False
        if isinstance(actual, list):
            return any(item in expected_values for item in actual)
        return actual in expected_values
    if operator == "$nin":
        return not _match_operator(actual, "$in", expected, found)
    if operator in {"$gt", "$gte", "$lt", "$lte"}:
        return _compare(actual, expected, operator)
    if operator == "$regex":
        if actual is _MISSING:
            return False
        flags = 0
        return re.search(str(expected), str(actual), flags) is not None
    if operator == "$options":
        return True
    return False


def _matches(document: dict[str, Any], query: dict[str, Any] | None) -> bool:
    if not query:
        return True
    for key, expected in query.items():
        if key == "$or":
            if not any(_matches(document, option) for option in expected):
                return False
            continue
        if key == "$and":
            if not all(_matches(document, option) for option in expected):
                return False
            continue

        actual = _get_nested(document, key)
        found = actual is not _MISSING
        if isinstance(expected, dict) and any(str(op).startswith("$") for op in expected):
            for operator, operator_value in expected.items():
                if operator == "$regex":
                    flags = re.IGNORECASE if "i" in str(expected.get("$options", "")) else 0
                    if actual is _MISSING or re.search(str(operator_value), str(actual), flags) is None:
                        return False
                    continue
                if not _match_operator(actual, operator, operator_value, found):
                    return False
        elif not _values_equal(actual, expected):
            return False
    return True


def _project(document: dict[str, Any], projection: dict[str, Any] | None) -> dict[str, Any]:
    projected = _clone_document(document)
    if not projection:
        return projected

    include_keys = {key for key, value in projection.items() if value and key != "_id"}
    exclude_keys = {key for key, value in projection.items() if not value}

    if include_keys:
        projected = {
            key: _get_nested(document, key)
            for key in include_keys
            if _get_nested(document, key) is not _MISSING
        }
        if projection.get("_id", 1) and "_id" in document:
            projected["_id"] = document["_id"]
    else:
        for key in exclude_keys:
            _unset_nested(projected, key)
    return projected


def _sort_key(document: dict[str, Any], field: str) -> tuple[int, int, Any]:
    value = _get_nested(document, field)
    if value is _MISSING or value is None:
        return (1, 0, "")
    if isinstance(value, bool):
        return (0, 0, int(value))
    if isinstance(value, (int, float)):
        return (0, 0, float(value))
    return (0, 1, str(value))


def _apply_update(document: dict[str, Any], update: dict[str, Any]) -> dict[str, Any]:
    updated = _clone_document(document)
    if not update:
        return updated

    uses_operators = any(str(key).startswith("$") for key in update)
    if not uses_operators:
        replacement = _clone_document(update)
        replacement.setdefault("_id", updated.get("_id", str(uuid.uuid4())))
        return replacement

    for key, value in update.get("$set", {}).items():
        _set_nested(updated, key, value)
    for key in update.get("$unset", {}):
        _unset_nested(updated, key)
    for key, value in update.get("$inc", {}).items():
        current = _get_nested(updated, key)
        if current is _MISSING:
            current = 0
        _set_nested(updated, key, current + value)
    for key, value in update.get("$setOnInsert", {}).items():
        if _get_nested(updated, key) is _MISSING:
            _set_nested(updated, key, value)
    for key, value in update.get("$addToSet", {}).items():
        current = _get_nested(updated, key)
        if current is _MISSING or not isinstance(current, list):
            current = []
        values = value.get("$each", []) if isinstance(value, dict) and "$each" in value else [value]
        for item in values:
            item = _to_jsonable(item)
            if item not in current:
                current.append(item)
        _set_nested(updated, key, current)
    for key, value in update.get("$push", {}).items():
        current = _get_nested(updated, key)
        if current is _MISSING or not isinstance(current, list):
            current = []
        values = value.get("$each", []) if isinstance(value, dict) and "$each" in value else [value]
        current.extend(_to_jsonable(item) for item in values)
        _set_nested(updated, key, current)
    for key, value in update.get("$pull", {}).items():
        current = _get_nested(updated, key)
        if isinstance(current, list):
            current = [item for item in current if not _values_equal(item, value)]
            _set_nested(updated, key, current)
    return updated


def _document_from_query(query: dict[str, Any]) -> dict[str, Any]:
    document: dict[str, Any] = {}
    for key, value in query.items():
        if key.startswith("$"):
            continue
        if isinstance(value, dict) and any(str(op).startswith("$") for op in value):
            continue
        _set_nested(document, key, value)
    return document


class AsyncSQLiteClient:
    def __init__(self, path: str):
        self.path = path
        if path != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self._connection = sqlite3.connect(path, check_same_thread=False)
        self._connection.row_factory = sqlite3.Row
        self._lock = threading.RLock()
        self._ensure_schema()

    def _ensure_schema(self) -> None:
        with self._lock:
            self._connection.execute(
                """
                CREATE TABLE IF NOT EXISTS documents (
                    database_name TEXT NOT NULL,
                    collection_name TEXT NOT NULL,
                    document_key TEXT NOT NULL,
                    document_json TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (database_name, collection_name, document_key)
                )
                """
            )
            self._connection.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_documents_collection
                ON documents (database_name, collection_name)
                """
            )
            self._connection.commit()

    async def _run(self, func):
        def locked():
            with self._lock:
                return func()

        return await asyncio.to_thread(locked)

    def __getitem__(self, database_name: str) -> "AsyncSQLiteDatabase":
        return AsyncSQLiteDatabase(self, database_name)

    def close(self) -> None:
        with self._lock:
            self._connection.close()


class AsyncSQLiteDatabase:
    def __init__(self, client: AsyncSQLiteClient, name: str):
        self.client = client
        self.name = name

    def __getitem__(self, collection_name: str) -> "AsyncSQLiteCollection":
        return AsyncSQLiteCollection(self.client, self.name, collection_name)

    def __getattr__(self, collection_name: str) -> "AsyncSQLiteCollection":
        if collection_name.startswith("__"):
            raise AttributeError(collection_name)
        return self[collection_name]

    async def command(self, command_name: str) -> dict[str, int]:
        if command_name != "ping":
            raise NotImplementedError(f"Unsupported SQLite command: {command_name}")
        await self.client._run(lambda: self.client._connection.execute("SELECT 1").fetchone())
        return {"ok": 1}


class AsyncSQLiteCollection:
    def __init__(self, client: AsyncSQLiteClient, database_name: str, collection_name: str):
        self.client = client
        self.database_name = database_name
        self.collection_name = collection_name

    async def _load_documents(self) -> list[dict[str, Any]]:
        def load():
            rows = self.client._connection.execute(
                """
                SELECT document_json FROM documents
                WHERE database_name = ? AND collection_name = ?
                """,
                (self.database_name, self.collection_name),
            ).fetchall()
            return [json.loads(row["document_json"]) for row in rows]

        return await self.client._run(load)

    def _save_document_sync(self, document: dict[str, Any], *, insert: bool = False) -> str:
        stored = _clone_document(document)
        document_key = str(stored.get("_id") or stored.get("id") or uuid.uuid4())
        stored.setdefault("_id", document_key)
        payload = json.dumps(stored, sort_keys=True, separators=(",", ":"))

        statement = """
                INSERT INTO documents
                (database_name, collection_name, document_key, document_json, updated_at)
                VALUES (?, ?, ?, ?, ?)
                """
        if not insert:
            statement += " ON CONFLICT(database_name, collection_name, document_key) DO UPDATE SET document_json=excluded.document_json, updated_at=excluded.updated_at"
        self.client._connection.execute(
                statement,
                (
                    self.database_name,
                    self.collection_name,
                    document_key,
                    payload,
                    datetime.now(timezone.utc).isoformat(),
                ),
            )
        document.clear()
        document.update(stored)
        return document_key

    async def _save_document(self, document: dict[str, Any], *, insert: bool = False) -> str:
        def save():
            with self.client._connection:
                return self._save_document_sync(document, insert=insert)
        return await self.client._run(save)

    async def insert_one(self, document: dict[str, Any]) -> InsertOneResult:
        document_key = await self._save_document(document, insert=True)
        return InsertOneResult(inserted_id=document_key)

    async def insert_many(self, documents: list[dict[str, Any]]) -> InsertManyResult:
        inserted_ids = []
        for document in documents:
            inserted_ids.append(await self._save_document(document, insert=True))
        return InsertManyResult(inserted_ids=inserted_ids)

    def find(self, query: dict[str, Any] | None = None, projection: dict[str, Any] | None = None) -> "AsyncSQLiteCursor":
        return AsyncSQLiteCursor(self, query or {}, projection)

    async def find_one(
        self,
        query: dict[str, Any] | None = None,
        projection: dict[str, Any] | None = None,
        sort: list[tuple[str, int]] | None = None,
    ) -> dict[str, Any] | None:
        cursor = self.find(query, projection)
        if sort:
            cursor.sort(sort)
        results = await cursor.limit(1).to_list(1)
        return results[0] if results else None

    async def update_one(self, query: dict[str, Any], update: dict[str, Any], upsert: bool = False) -> UpdateResult:
        result = await self._update(query, update, upsert=upsert, multi=False)
        return result

    async def update_many(self, query: dict[str, Any], update: dict[str, Any], upsert: bool = False) -> UpdateResult:
        return await self._update(query, update, upsert=upsert, multi=True)

    async def _update(self, query: dict[str, Any], update: dict[str, Any], upsert: bool, multi: bool) -> UpdateResult:
        def apply():
            # Hold the write transaction across both reads and writes: concurrent
            # increments, upserts and conditional claims must not lose updates.
            with self.client._connection:
                self.client._connection.execute("BEGIN IMMEDIATE")
                rows = self.client._connection.execute(
                    "SELECT document_json FROM documents WHERE database_name=? AND collection_name=?",
                    (self.database_name, self.collection_name),
                ).fetchall()
                matched = [doc for row in rows if _matches(doc := json.loads(row["document_json"]), query)]
                if not matched and upsert:
                    document = _document_from_query(query)
                    document.setdefault("_id", str(uuid.uuid4()))
                    key = self._save_document_sync(_apply_update(document, update), insert=True)
                    return UpdateResult(upserted_id=key)
                targeted = matched if multi else matched[:1]
                modified_count = 0
                for document in targeted:
                    updated = _apply_update(document, update)
                    if updated != document:
                        modified_count += 1
                        self._save_document_sync(updated)
                return UpdateResult(matched_count=len(targeted), modified_count=modified_count)
        return await self.client._run(apply)

    async def delete_one(self, query: dict[str, Any]) -> DeleteResult:
        return await self._delete(query, multi=False)

    async def delete_many(self, query: dict[str, Any]) -> DeleteResult:
        return await self._delete(query, multi=True)

    async def _delete(self, query: dict[str, Any], multi: bool) -> DeleteResult:
        documents = await self._load_documents()
        keys = [
            str(document.get("_id") or document.get("id"))
            for document in documents
            if _matches(document, query)
        ]
        if not multi:
            keys = keys[:1]

        def delete():
            for key in keys:
                self.client._connection.execute(
                    """
                    DELETE FROM documents
                    WHERE database_name = ? AND collection_name = ? AND document_key = ?
                    """,
                    (self.database_name, self.collection_name, key),
                )
            self.client._connection.commit()

        await self.client._run(delete)
        return DeleteResult(deleted_count=len(keys))

    async def count_documents(self, query: dict[str, Any] | None = None) -> int:
        documents = await self._load_documents()
        return sum(1 for document in documents if _matches(document, query or {}))

    async def create_index(self, *args, **kwargs) -> str:
        fields = args[0] if args else kwargs.get("keys")
        if isinstance(fields, str):
            fields = [(fields, 1)]
        if not fields:
            raise ValueError("Index fields are required")
        unique = bool(kwargs.get("unique"))
        identity = json.dumps([self.database_name, self.collection_name, fields, unique])
        name = "idx_json_" + hashlib.sha256(identity.encode()).hexdigest()[:24]
        def literal(value):
            return "'" + str(value).replace("'", "''") + "'"
        expressions = []
        for field, direction in fields:
            if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_.]*", field):
                raise ValueError("Invalid index field")
            expressions.append(f"json_extract(document_json, {literal('$.' + field)})" + (" DESC" if direction == -1 else " ASC"))
        statement = (
            f"CREATE {'UNIQUE ' if unique else ''}INDEX IF NOT EXISTS {name} ON documents ({', '.join(expressions)}) "
            f"WHERE database_name={literal(self.database_name)} AND collection_name={literal(self.collection_name)}"
        )
        def create():
            with self.client._connection:
                self.client._connection.execute(statement)
        await self.client._run(create)
        return name

    def aggregate(self, pipeline: list[dict[str, Any]]) -> "AsyncSQLiteAggregateCursor":
        return AsyncSQLiteAggregateCursor(self, pipeline)


class AsyncSQLiteCursor:
    def __init__(
        self,
        collection: AsyncSQLiteCollection,
        query: dict[str, Any],
        projection: dict[str, Any] | None,
    ):
        self.collection = collection
        self.query = query
        self.projection = projection
        self._sorts: list[tuple[str, int]] = []
        self._limit: int | None = None
        self._skip = 0
        self._loaded: list[dict[str, Any]] | None = None
        self._position = 0

    def sort(self, key_or_list, direction: int | None = None) -> "AsyncSQLiteCursor":
        if isinstance(key_or_list, str):
            self._sorts.append((key_or_list, direction if direction is not None else 1))
        else:
            self._sorts.extend(list(key_or_list))
        return self

    def limit(self, limit: int) -> "AsyncSQLiteCursor":
        self._limit = limit
        return self

    def skip(self, skip: int) -> "AsyncSQLiteCursor":
        self._skip = skip
        return self

    async def _load(self) -> list[dict[str, Any]]:
        documents = [
            document
            for document in await self.collection._load_documents()
            if _matches(document, self.query)
        ]
        for field, direction in reversed(self._sorts):
            documents.sort(key=lambda document: _sort_key(document, field), reverse=direction < 0)
        if self._skip:
            documents = documents[self._skip :]
        if self._limit is not None:
            documents = documents[: self._limit]
        return [_project(document, self.projection) for document in documents]

    async def to_list(self, length: int | None = None) -> list[dict[str, Any]]:
        documents = await self._load()
        if length is not None:
            documents = documents[:length]
        return documents

    def __aiter__(self) -> "AsyncSQLiteCursor":
        return self

    async def __anext__(self) -> dict[str, Any]:
        if self._loaded is None:
            self._loaded = await self._load()
        if self._position >= len(self._loaded):
            raise StopAsyncIteration
        item = self._loaded[self._position]
        self._position += 1
        return item


class AsyncSQLiteAggregateCursor:
    def __init__(self, collection: AsyncSQLiteCollection, pipeline: list[dict[str, Any]]):
        self.collection = collection
        self.pipeline = pipeline
        self._loaded: list[dict[str, Any]] | None = None
        self._position = 0

    async def _load(self) -> list[dict[str, Any]]:
        documents = await self.collection._load_documents()
        for stage in self.pipeline:
            if "$match" in stage:
                documents = [document for document in documents if _matches(document, stage["$match"])]
            elif "$group" in stage:
                group_spec = stage["$group"]
                key_expr = group_spec.get("_id")
                grouped: dict[Any, dict[str, Any]] = {}
                for document in documents:
                    if isinstance(key_expr, str) and key_expr.startswith("$"):
                        key = _get_nested(document, key_expr[1:])
                    else:
                        key = key_expr
                    if key is _MISSING:
                        key = None
                    row = grouped.setdefault(key, {"_id": key})
                    for output_key, expression in group_spec.items():
                        if output_key == "_id":
                            continue
                        if isinstance(expression, dict) and "$sum" in expression:
                            operand = expression["$sum"]
                            if isinstance(operand, str) and operand.startswith("$"):
                                value = _get_nested(document, operand[1:])
                                row[output_key] = row.get(output_key, 0) + (0 if value is _MISSING else value)
                            else:
                                row[output_key] = row.get(output_key, 0) + operand
                documents = list(grouped.values())
            elif "$sort" in stage:
                for field, direction in reversed(list(stage["$sort"].items())):
                    documents.sort(key=lambda document: _sort_key(document, field), reverse=direction < 0)
            elif "$limit" in stage:
                documents = documents[: int(stage["$limit"])]
            elif "$project" in stage:
                documents = [_project(document, stage["$project"]) for document in documents]
        return [_clone_document(document) for document in documents]

    async def to_list(self, length: int | None = None) -> list[dict[str, Any]]:
        documents = await self._load()
        if length is not None:
            documents = documents[:length]
        return documents

    def __aiter__(self) -> "AsyncSQLiteAggregateCursor":
        return self

    async def __anext__(self) -> dict[str, Any]:
        if self._loaded is None:
            self._loaded = await self._load()
        if self._position >= len(self._loaded):
            raise StopAsyncIteration
        item = self._loaded[self._position]
        self._position += 1
        return item
