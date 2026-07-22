"""
Self-check for the redirect path. Run: python test_record.py

Covers the two guarantees that make a server-side 307 safe:
  1) an expired key never resolves, so we can't 307 someone to a dead link
  2) expired keys are reclaimed into the dictionary and reissued, which is
     exactly why the redirect is 307 and not a permanently-cached 301
"""
import os
import sqlite3
import tempfile
from http import HTTPStatus

import record
from init import make_urls


def setup(db: str):
    record.dbfile = db
    with sqlite3.connect(db) as con:
        cur = con.cursor()
        cur.execute("DROP TABLE IF EXISTS dict")
        cur.execute("CREATE TABLE dict (word TEXT PRIMARY KEY, used INTEGER DEFAULT 0)")
        cur.executemany("INSERT INTO dict (word) VALUES (?)", [("apple",), ("pear",), ("melon",)])
        # Only "apple" is selectable, so the random pick below is deterministic
        cur.execute("UPDATE dict SET used = 1 WHERE word IN ('pear', 'melon')")
        make_urls(con.commit, cur)


def used(db: str, word: str) -> int:
    with sqlite3.connect(db) as con:
        return con.execute("SELECT used FROM dict WHERE word = ?", (word,)).fetchone()[0]


def demo():
    db = os.path.join(tempfile.mkdtemp(), "test.db")
    setup(db)

    # A fresh record resolves and burns its dictionary word
    status, key, _ = record.create_record("https://example.com", expires_in="never")
    assert status == HTTPStatus.OK, status
    assert key == "apple", key
    assert used(db, key) == 1
    assert record.search_for_redirect(key) == (HTTPStatus.OK, "Got one record", "https://example.com")

    # Same URL again reuses the existing key rather than burning a second word
    assert record.create_record("https://example.com")[1] == key

    # Protocol-less input is normalised, not rejected
    assert record.create_record("example.org/x", custom_keyword="custom")[0] == HTTPStatus.OK
    assert record.search_for_redirect("custom")[2] == "https://example.org/x"

    # An expired record must not resolve — otherwise we'd 307 into a dead link
    with sqlite3.connect(db) as con:
        con.execute(
            "INSERT INTO urls (orig, short, expires_at) VALUES (?, ?, datetime('now', '-1 hour'))",
            ("https://gone.example", "melon"),
        )
        con.commit()
    assert record.search_for_redirect("melon")[0] == HTTPStatus.NOT_FOUND

    # ...and its word goes back in the pool, so the key can point somewhere else later
    record.cleanup_expired()
    assert used(db, "melon") == 0

    # Unknown keys 404, which is what nginx turns into the SPA fallback
    assert record.search_for_redirect("nosuchkey")[0] == HTTPStatus.NOT_FOUND

    print("ok")


if __name__ == "__main__":
    demo()
