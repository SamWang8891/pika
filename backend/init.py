import re
from sqlite3 import Cursor
from typing import Callable

forbidden: set[str] = {'login', 'admin', 'logout', 'api', 'index', 'index.html', 'change_pass', ''}


def load_dictionary(commit: Callable, cur: Cursor, text_file: str):
    """
    Load the dictionary from a text file into the database.

    :param commit: Callable to commit the transaction
    :param cur: Cursor of the database
    :param text_file: Path to the text file containing the dictionary
    """
    cur.execute('DROP TABLE IF EXISTS dict')
    cur.execute('''
                CREATE TABLE IF NOT EXISTS dict
                (
                    word TEXT PRIMARY KEY,
                    used INTEGER DEFAULT 0
                )
                ''')

    with open(text_file, 'r') as file:
        words = file.readlines()

    for word in words:
        w = word.strip()
        # OR IGNORE so a duplicate line can't crash startup on the word PRIMARY KEY;
        # del_forbidden_word also dedupes, this is the belt-and-suspenders.
        cur.execute('''
                    INSERT OR IGNORE INTO dict (word)
                    VALUES (?)
                    ''', (w,))

    commit()


def make_urls(commit: Callable, cur: Cursor):
    """
    Create the table to store the URLs.

    :param commit: Callable to commit the transaction
    :param cur: Cursor of the database
    """
    cur.execute('DROP TABLE IF EXISTS urls')
    cur.execute('''
                CREATE TABLE IF NOT EXISTS urls
                (
                    orig       TEXT,
                    short      TEXT UNIQUE,
                    created_at TEXT DEFAULT (datetime('now')),
                    expires_at TEXT
                )
                ''')

    commit()


def make_login(commit: Callable, cur: Cursor):
    """
    Create the table to store the login credentials.

    :param commit: Callable to commit the transaction
    :param cur: Cursor of the database
    """
    cur.execute('DROP TABLE IF EXISTS login')
    cur.execute('''
                CREATE TABLE IF NOT EXISTS login
                (
                    username TEXT PRIMARY KEY,
                    password TEXT
                )
                ''')
    commit()

    # default username: admin, password: password
    username = "admin"
    password = "$argon2id$v=19$m=102400,t=2,p=8$l7bMrtz82jfIJk5Uq82mGQ$1ABNbzjrDJ6WPNnhGi5UpQ"
    cur.execute("INSERT INTO login (username, password) VALUES (?, ?)", (username, password))
    commit()


def sort_dict(text_file: str):
    """
    Sort the words in a text file alphabetically.

    :param text_file: The path to the text file containing the dictionary
    """
    # Read the contents of the file
    with open(text_file, 'r') as file:
        words = file.readlines()

    # Sort the words alphabetically
    sorted_words = sorted(word.strip() for word in words)

    # Write the sorted words back to the file
    with open(text_file, 'w') as file:
        for word in sorted_words:
            file.write(word + '\n')


def del_forbidden_word(textfile: str):
    """
    Cleans a text file by performing the following:
    - Removes lines that are either empty or match any forbidden words.
    - Removes lines containing characters other than alphanumeric (letters and numbers).
    - Removes duplicate lines (lines are deduplicated when saved back).

    Only overwrites the original file if at least one line is deemed illegal.

    :param textfile: The path to the text file to be cleaned.
    :return: None
    """

    needs_rewrite: bool = False

    words = set()
    with open(textfile, 'r') as file:
        for line in file:
            line = line.strip()
            if (line in forbidden) or (re.match(r"^[A-Za-z0-9]*$", line) is None):
                needs_rewrite = True  # illegal line: drop it
                continue
            if line in words:
                needs_rewrite = True  # duplicate: dedupe on rewrite
                continue

            words.add(line)

    if needs_rewrite:
        with open(textfile, 'w') as file:
            file.write('\n'.join(sorted(words)))
