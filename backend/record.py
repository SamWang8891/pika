import os
import re
import sqlite3
from enum import StrEnum
from http import HTTPStatus
from sqlite3 import Connection

from init import forbidden

dbfile = os.path.join(os.path.dirname(__file__), "data.db")


def create_record(original_url: str, custom_keyword: str = "") -> tuple[int, str | None, str]:
    """
    Create a new shorten URL record in the database

    :param original_url: The original URL to shorten
    :param custom_keyword: The custom keyword to use, empty for random from the database
    :return: A tuple. The 1st element (int) is the status code. The 2nd element (int) is the return code. The 3rd element (str) is the shortened keyword. The 4th element (str) is a message.
    """

    if not original_url.startswith(('https://', 'http://')):
        original_url = 'https://' + original_url

    with sqlite3.connect(dbfile) as con:
        cur = con.cursor()

        custom_keyword.strip()

        # If user are creating the record with self-define keyword,
        # check if the keyword is used, if not then create it.
        # Ignore if there is an existing record with different shortened keyword

        # If user give a custom keyword
        if custom_keyword != "":
            # Check if the keyword is illegal
            if (custom_keyword in forbidden) or (re.match(r"^[A-Za-z0-9]*$", custom_keyword) is None):
                return HTTPStatus.BAD_REQUEST, None, "Keyword is illegal!"

            # Check if the keyword is occupied
            cur.execute("SELECT short FROM urls WHERE short = ?", (custom_keyword,))
            result = cur.fetchone()
            if result:
                # The keyword is already occupied, check if it's the same as the request
                if result[0] == custom_keyword:
                    return HTTPStatus.OK, custom_keyword, "Custom record same as last request!"
                return HTTPStatus.CONFLICT, None, "Keyword is occupied!"

            # Check if the keywork is within the dictionary
            cur.execute("SELECT word FROM dict WHERE word = ?", (custom_keyword,))
            result = cur.fetchone()
            if result:
                cur.execute("UPDATE dict SET used = 1 WHERE word = ?", (custom_keyword,))

            # Create a record with that keyword
            cur.execute("INSERT INTO urls (orig, short) VALUES (?, ?)", (original_url, custom_keyword))

            return HTTPStatus.OK, custom_keyword, "Custom record created!"
        else:
            # Check if the original URL is already in the database
            cur.execute("SELECT short FROM urls WHERE orig = ?", (original_url,))
            result = cur.fetchone()
            if result and (existing_short_key := result[0]):
                return HTTPStatus.OK, existing_short_key, "Existing record found!"

            cur.execute("SELECT word FROM dict WHERE used = 0 ORDER BY RANDOM() LIMIT 1")
            shortened_key = cur.fetchone()[0]

            cur.execute("UPDATE dict SET used = 1 WHERE word = ?", (shortened_key,))
            cur.execute("INSERT INTO urls (orig, short) VALUES (?, ?)", (original_url, shortened_key))
            con.commit()
            return HTTPStatus.OK, shortened_key, "Record created!"


def delete_record(url: str) -> tuple[int, str]:
    """
    Delete the record from the database

    :param url: The URL to delete, see app.py (/api/v2/delete_record) for the detailed accepted types
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
        ### Is a short only
        status, message, short_str = search(url, query_type=UrlRowType.SHORT, response_type=UrlRowType.SHORT, con=con)
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
        con: Connection = None
) -> tuple[int, str, str | None]:
    """
    Search for the linked short -> orig or orig -> short URL or verify if the URL exists

    :param url: The URL to search/verify
    :param query_type: The type of URL to search from
    :param response_type: The type of URL to return
    :param con: The connection to the database
    :return: The corresponding URL if found [status, message, search result | None], None otherwise
    """
    tmp_con: bool = con is None
    if tmp_con: con = sqlite3.connect(dbfile)

    cur = con.cursor()
    # Check if there are multiple records
    all_responses = cur.execute(f"SELECT {response_type} FROM urls WHERE {query_type} = ?", (url,)).fetchall()

    print(f"Search type: {query_type} -> {response_type}\nSearching: {url}, Found: {all_responses}")

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
    try:
        cur.execute("UPDATE dict SET used = 0 WHERE word = ?",
                    (unused_short_word,))  # If the word is a custom word, this line might fail, but it's okay
    except:
        pass
    con.commit()


def get_all_records() -> tuple[int, str, list[dict[str, str]]]:
    """
    Get all records from the database

    :return: A tuple of (status_code, message, list of records), each record containing 'orig' and 'short' keys
    """
    with sqlite3.connect(dbfile) as con:
        cur = con.cursor()
        cur.execute("SELECT orig, short FROM urls")
        records = cur.fetchall()
        record_list = [{"orig": orig, "short": short} for orig, short in records]
        return HTTPStatus.OK, "Success", record_list
