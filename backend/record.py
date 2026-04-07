import os
import re
import sqlite3
from enum import StrEnum
from http import HTTPStatus
from sqlite3 import Connection

from init import forbidden

dbfile = os.path.join(os.path.dirname(__file__), "data.db")


def create_record(original_url: str, custom_keyword: str = "", expires_in: str = "7d") -> tuple[int, str | None, str]:
    """
    Create a new shorten URL record in the database

    :param original_url: The original URL to shorten
    :param custom_keyword: The custom keyword to use, empty for random from the database
    :param expires_in: Expiration preset: "1h", "12h", "1d", "7d", "never", or custom minutes as int string
    :return: A tuple of (status_code, shortened_keyword_or_None, message)
    """

    # Validate URL does not contain spaces
    if ' ' in original_url:
        return HTTPStatus.BAD_REQUEST, None, "URL must not contain spaces!"

    if not original_url.startswith(('https://', 'http://')):
        original_url = 'https://' + original_url

    # Calculate expires_at timestamp
    expires_at = _calc_expires_at(expires_in)

    with sqlite3.connect(dbfile) as con:
        cur = con.cursor()

        custom_keyword = custom_keyword.strip()

        # If user give a custom keyword
        if custom_keyword != "":
            # Check if the keyword is illegal
            if (custom_keyword in forbidden) or (re.match(r"^[A-Za-z0-9]*$", custom_keyword) is None):
                return HTTPStatus.BAD_REQUEST, None, "Keyword is illegal!"

            # Check if the keyword is occupied (only consider non-expired records)
            cur.execute(
                "SELECT orig FROM urls WHERE short = ? AND (expires_at IS NULL OR expires_at > datetime('now'))",
                (custom_keyword,)
            )
            result = cur.fetchone()
            if result:
                # The keyword is already occupied — check if same original URL
                if result[0] == original_url:
                    return HTTPStatus.OK, custom_keyword, "Custom record same as last request!"
                return HTTPStatus.CONFLICT, None, "Keyword is occupied!"

            # Check if the keyword is within the dictionary
            cur.execute("SELECT word FROM dict WHERE word = ?", (custom_keyword,))
            result = cur.fetchone()
            if result:
                cur.execute("UPDATE dict SET used = 1 WHERE word = ?", (custom_keyword,))

            # Create a record with that keyword
            cur.execute(
                "INSERT INTO urls (orig, short, created_at, expires_at) VALUES (?, ?, datetime('now'), ?)",
                (original_url, custom_keyword, expires_at)
            )
            con.commit()

            return HTTPStatus.OK, custom_keyword, "Custom record created!"
        else:
            # Check if the original URL is already in the database (and not expired)
            cur.execute(
                "SELECT short FROM urls WHERE orig = ? AND (expires_at IS NULL OR expires_at > datetime('now'))",
                (original_url,)
            )
            result = cur.fetchone()
            if result and (existing_short_key := result[0]):
                return HTTPStatus.OK, existing_short_key, "Existing record found!"

            cur.execute("SELECT word FROM dict WHERE used = 0 ORDER BY RANDOM() LIMIT 1")
            row = cur.fetchone()
            if not row:
                return HTTPStatus.SERVICE_UNAVAILABLE, None, "No available words left in the dictionary!"

            shortened_key = row[0]

            cur.execute("UPDATE dict SET used = 1 WHERE word = ?", (shortened_key,))
            cur.execute(
                "INSERT INTO urls (orig, short, created_at, expires_at) VALUES (?, ?, datetime('now'), ?)",
                (original_url, shortened_key, expires_at)
            )
            con.commit()
            return HTTPStatus.OK, shortened_key, "Record created!"


def _calc_expires_at(expires_in: str) -> str | None:
    """
    Calculate the expiration datetime string from a preset.

    :param expires_in: "1h", "12h", "1d", "7d", "never"
    :return: SQLite datetime string or None for never
    """
    from datetime import datetime, timedelta, timezone

    if expires_in == "never":
        return None

    now = datetime.now(timezone.utc)
    presets = {
        "1h": timedelta(hours=1),
        "12h": timedelta(hours=12),
        "1d": timedelta(days=1),
        "7d": timedelta(days=7),
    }

    delta = presets.get(expires_in)
    if delta is None:
        # Try parsing as custom minutes
        try:
            minutes = int(expires_in)
            if minutes <= 0:
                delta = presets["7d"]
            else:
                delta = timedelta(minutes=minutes)
        except (ValueError, TypeError):
            delta = presets["7d"]  # fallback to 7 days

    return (now + delta).strftime("%Y-%m-%d %H:%M:%S")


def delete_record(url: str) -> tuple[int, str]:
    """
    Delete the record from the database

    :param url: The URL to delete, see app.py (/api/v3/delete_record) for the detailed accepted types
    :return: A tuple. First element (int) is the status code. Second element (str) is the return message.
    """
    with sqlite3.connect(dbfile) as con:
        url = url.lstrip('/')  # Prevent user input the shortened part starting with "/" like "/apple"

        # Check original URL
        ### Is Missing protocol
        if not (url.startswith('https://') or url.startswith('http://')):
            mod_url = 'https://' + url
            status, message, short_str = search(mod_url, query_type=UrlRowType.ORIG, response_type=UrlRowType.SHORT,
                                                con=con)
            if status != HTTPStatus.NOT_FOUND:
                if status == HTTPStatus.OK:
                    delete(con, short_str)
                return status, message

        ### Is a complete URL
        status, message, short_str = search(url, query_type=UrlRowType.ORIG, response_type=UrlRowType.SHORT, con=con)
        if status != HTTPStatus.NOT_FOUND:
            if status == HTTPStatus.OK:
                delete(con, short_str)
            return status, message

        # Check short URL
        ### Is a short only (don't filter by expiry so expired records can be explicitly deleted)
        status, message, short_str = search(url, query_type=UrlRowType.SHORT, response_type=UrlRowType.SHORT, con=con, check_expiry=False)
        if status != HTTPStatus.NOT_FOUND:
            if status == HTTPStatus.OK:
                delete(con, short_str)
            return status, message

        # No matching record
        return HTTPStatus.NOT_FOUND, "No matching record found."


def delete_all_records():
    """
    Purge all records in the database
    """
    with sqlite3.connect(dbfile) as con:
        cur = con.cursor()
        cur.execute("DELETE FROM urls")
        cur.execute("UPDATE dict SET used = 0;")
        con.commit()


class UrlRowType(StrEnum):
    """
    Enum for the URL row type.
    """
    SHORT = "short"
    ORIG = "orig"


def search(
        url: str,
        query_type: UrlRowType = UrlRowType.SHORT,  # may be "orig" or "short"
        response_type: UrlRowType = UrlRowType.ORIG,  # may be "orig" or "short"
        con: Connection = None,
        check_expiry: bool = True
) -> tuple[int, str, str | None]:
    """
    Search for the linked short -> orig or orig -> short URL or verify if the URL exists

    :param url: The URL to search/verify
    :param query_type: The type of URL to search from
    :param response_type: The type of URL to return
    :param con: The connection to the database
    :param check_expiry: Whether to filter out expired records
    :return: The corresponding URL if found [status, message, search result | None], None otherwise
    """
    tmp_con: bool = con is None
    if tmp_con: con = sqlite3.connect(dbfile)

    cur = con.cursor()

    expiry_clause = " AND (expires_at IS NULL OR expires_at > datetime('now'))" if check_expiry else ""
    all_responses = cur.execute(
        f"SELECT {response_type} FROM urls WHERE {query_type} = ?{expiry_clause}", (url,)
    ).fetchall()

    if tmp_con: con.close()

    if not all_responses:
        return HTTPStatus.NOT_FOUND, "No matching record found", None
    if len(all_responses) == 1:
        return HTTPStatus.OK, "Got one record", all_responses[0][0]
    else:  # Multiple result
        return HTTPStatus.MULTIPLE_CHOICES, "Multiple found", None


def delete(
        con,
        unused_short_word: str
):
    """
    Delete the record from the database

    :param con: The connection to the database
    :param unused_short_word:
    :return:
    """
    cur = con.cursor()
    cur.execute(f"DELETE FROM urls WHERE short = ?", (unused_short_word,))
    cur.execute("UPDATE dict SET used = 0 WHERE word = ?", (unused_short_word,))
    con.commit()


def cleanup_expired():
    """
    Remove expired records and reclaim their dictionary words.
    """
    with sqlite3.connect(dbfile) as con:
        cur = con.cursor()
        # Find expired short keys to reclaim dictionary words
        cur.execute("SELECT short FROM urls WHERE expires_at IS NOT NULL AND expires_at <= datetime('now')")
        expired = cur.fetchall()
        for (short_key,) in expired:
            cur.execute("UPDATE dict SET used = 0 WHERE word = ?", (short_key,))
        cur.execute("DELETE FROM urls WHERE expires_at IS NOT NULL AND expires_at <= datetime('now')")
        con.commit()


def get_all_records() -> tuple[int, str, list[dict[str, str]]]:
    """
    Get all records from the database

    :return: A tuple of (status_code, message, list of records)
    """
    # Clean up expired records first
    cleanup_expired()

    with sqlite3.connect(dbfile) as con:
        cur = con.cursor()
        cur.execute("SELECT orig, short, created_at, expires_at FROM urls")
        records = cur.fetchall()
        record_list = [
            {"orig": orig, "short": short, "created_at": created_at, "expires_at": expires_at}
            for orig, short, created_at, expires_at in records
        ]
        return HTTPStatus.OK, "Success", record_list
