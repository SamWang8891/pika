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
import threading
from http import HTTPStatus

import init
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


def demo_dedup():
    """A duplicated but otherwise-legal word must not crash startup."""
    d = tempfile.mkdtemp()
    txt = os.path.join(d, "dictionary.txt")
    with open(txt, "w") as f:
        f.write("apple\napple\npear\n")  # 'apple' twice, both legal

    init.del_forbidden_word(txt)  # dedupes on rewrite...

    db = os.path.join(d, "test.db")
    with sqlite3.connect(db) as con:
        cur = con.cursor()
        init.load_dictionary(con.commit, cur, txt)  # ...and this must not raise on the PK
        rows = cur.execute("SELECT word FROM dict ORDER BY word").fetchall()
    assert rows == [("apple",), ("pear",)], rows

    print("ok dedup")


def demo_concurrent_alloc():
    """Concurrent creates must never 500 on a UNIQUE collision, nor hand the same word twice."""
    db = os.path.join(tempfile.mkdtemp(), "test.db")
    record.dbfile = db
    with sqlite3.connect(db) as con:
        cur = con.cursor()
        cur.execute("DROP TABLE IF EXISTS dict")
        cur.execute("CREATE TABLE dict (word TEXT PRIMARY KEY, used INTEGER DEFAULT 0)")
        cur.executemany("INSERT INTO dict (word) VALUES (?)", [("a",), ("b",), ("c",)])
        make_urls(con.commit, cur)

    results, lock = [], threading.Lock()

    def worker(i):
        try:
            status, key, _ = record.create_record(f"https://example.com/{i}", expires_in="never")
            out = (status, key, None)
        except Exception as e:  # the whole point is to prove none escape as a 500
            out = (None, None, repr(e))
        with lock:
            results.append(out)

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(5)]
    for t in threads: t.start()
    for t in threads: t.join()

    assert not [r[2] for r in results if r[2]], [r[2] for r in results if r[2]]
    keys = [r[1] for r in results if r[0] == HTTPStatus.OK]
    assert len(keys) == len(set(keys)), keys  # no word allocated twice
    assert sorted(keys) == ["a", "b", "c"], keys  # all three, cleanly exhausted

    print("ok concurrent")


if __name__ == "__main__":
    demo()
    demo_dedup()
    demo_concurrent_alloc()
