#!/usr/bin/env python3
"""Create or update a MongoDB user document with a hashed password.

Usage example:
  python scripts/create_mongo_user.py --email user@example.com --name "User Name" --role candidate
"""

from __future__ import annotations

import argparse
import getpass
import os
import sys
from datetime import datetime, timezone

from bson import ObjectId
from pymongo import MongoClient
import bcrypt


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create or update a MongoDB user with a hashed password.")
    parser.add_argument("--email", required=True, help="User email address")
    parser.add_argument("--name", required=True, help="User display name")
    parser.add_argument(
        "--role",
        default="candidate",
        choices=["candidate", "recruiter", "owner"],
        help="User role to store",
    )
    parser.add_argument(
        "--mongo-uri",
        default=os.getenv("MONGODB_URI"),
        help="MongoDB connection string (defaults to MONGODB_URI)",
    )
    parser.add_argument(
        "--db-name",
        default=os.getenv("MONGODB_DB_NAME", "hr-pain-solutions"),
        help="MongoDB database name",
    )
    parser.add_argument(
        "--collection",
        default="users",
        help="MongoDB collection name",
    )
    parser.add_argument(
        "--password",
        default=None,
        help="Optional password override. If omitted, you will be prompted via getpass.",
    )
    return parser.parse_args()


def prompt_password() -> str:
    password = getpass.getpass("Password: ")
    confirm = getpass.getpass("Confirm password: ")
    if password != confirm:
        raise ValueError("Passwords do not match")
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")
    return password


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def main() -> int:
    args = parse_args()

    if not args.mongo_uri:
    print("MONGODB_URI is required", file=sys.stderr)
    return 1

    password = args.password or prompt_password()
    password_hash = hash_password(password)

    client = MongoClient(args.mongo_uri)
    collection = client[args.db_name][args.collection]

    now = datetime.now(timezone.utc)
    result = collection.update_one(
        {"email": args.email.lower().strip()},
        {
            "$set": {
                "email": args.email.lower().strip(),
                "name": args.name.strip(),
                "role": args.role,
                "passwordHash": password_hash,
                "updatedAt": now,
            },
            "$setOnInsert": {
                "_id": ObjectId(),
                "createdAt": now,
            },
        },
        upsert=True,
    )

    print(f"Upserted user: {args.email} ({args.role})")
    print(f"Matched: {result.matched_count}, Modified: {result.modified_count}, Upserted: {result.upserted_id}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())