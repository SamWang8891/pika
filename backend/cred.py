import os
import sqlite3

from argon2 import PasswordHasher

dbfile = os.path.join(os.path.dirname(__file__), "data.db")


def is_permitted(username: str, password: str) -> bool:
    """
    Check if the username and password matches the stored credentials

    :param username: The username to check
    :param password: The password to verify
    :return: True if the credentials match, False otherwise
    """
    with sqlite3.connect(dbfile) as con:
        cur = con.cursor()
        cur.execute("SELECT password FROM login WHERE username = ?", (username,))
        if not (result := cur.fetchone()):
            return False

        stored_password = result[0]
        ph = PasswordHasher()
        try:
            ph.verify(stored_password, password)
            return True
        except:
            return False


def change_cred(new_password: str):
    """
    Change the password of the admin account

    :param new_password: The new password
    """
    print(new_password)
    with sqlite3.connect(dbfile) as con:
        cur = con.cursor()
        hashed = PasswordHasher().hash(new_password)
        cur.execute("UPDATE login SET password = ? WHERE username = 'admin'", (hashed,))
        con.commit()
