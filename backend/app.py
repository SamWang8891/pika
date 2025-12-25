import inspect
import os
import sqlite3

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, Request, Depends, Form, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from starlette.responses import RedirectResponse, JSONResponse
from http import HTTPStatus

from cred import is_permitted, change_cred
from init import del_forbidden_word, sort_dict, load_dictionary, make_urls, make_login
from record import create_record, delete_all_records, delete_record, get_all_records, search, UrlRowType
from schemas import StatusResponse, ShortenedResponse, SearchResponse, GetRecordsResponse

# -------------------------------
# Load dictionary and database
# -------------------------------
txtfile = os.path.join(os.path.dirname(__file__), 'dictionary.txt')
is_reset_password_file = os.path.join(os.path.dirname(__file__), 'is_reset_password.txt')
dbfile = os.path.join(os.path.dirname(__file__), 'data.db')

# -----------
# Load env
# -----------
load_dotenv()
ALLOWED_ORIGINS = os.getenv('ALLOWED_ORIGINS', '')
origins = [origin.strip() for origin in ALLOWED_ORIGINS.split(",") if origin.strip()]
SECRET_KEY = os.getenv('SECRET_KEY')
BEARER_TOKEN = os.getenv('BEARER_TOKEN')

# ----------------
# FastAPI setup
# ----------------
app = FastAPI(
    title="Simple URL Shortener Backend",
    description="Backend for Simple URL Shortener service.",
    version="2.0",
    openapi_url="/openapi.json",
    docs_url="/docs",
    root_path="/api/v2",
)

app.add_middleware(
    SessionMiddleware,
    secret_key=SECRET_KEY,
    max_age=1800,  # In seconds
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

bearer_scheme = HTTPBearer(auto_error=False)


async def verify_bearer_token(
        credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)
):
    if credentials and credentials.scheme == "Bearer" and credentials.credentials == BEARER_TOKEN:
        return True
    else:
        return False


class SessionData(BaseModel):
    permitted: bool


# ---------
# Routes
# ---------
@app.get(
    "/status",
    response_model=StatusResponse,
    summary="Status of backend",
    description="Get the statistics of backend.",
    tags=["Status"],
)
def status_route():
    return JSONResponse({
        "status": HTTPStatus.OK,
        "message": "It's alive!",
        "data": None,
    })


@app.post(
    "/logout",
    response_model=StatusResponse,
    summary="Logout",
    description="Logout the current logged in user.",
    tags=["Authentication"],
)
def logout_route(request: Request):
    request.session.pop("user", None)
    return JSONResponse({
        "status": HTTPStatus.OK,
        "message": "Successfully logged out!",
        "data": None,
    })


@app.post(
    "/login",
    response_model=StatusResponse,
    summary="Login",
    description="Login with username and password.",
    tags=["Authentication"],
)
async def login_route(request: Request, username: str = Form(...), password: str = Form(...)):
    if not is_permitted(username, password):
        request.session.pop("user", None)
        return JSONResponse({
            "status": HTTPStatus.UNAUTHORIZED,
            "message": "Unauthorized, wrong username or password.",
            "data": None,
        })

    request.session["user"] = SessionData(permitted=True).model_dump()
    return JSONResponse({
        "status": HTTPStatus.OK,
        "message": "Successfully logged in!",
        "data": None,
    })


@app.get(
    "/admin_check",
    response_model=StatusResponse,
    summary="Admin check",
    description="Check if the current session is an admin or not.",
    tags=["Authentication"],
)
async def check_user_route(request: Request):
    session_data = request.session.get("user", {"permitted": False})

    if not session_data.get("permitted"):
        return JSONResponse({
            "status": HTTPStatus.UNAUTHORIZED,
            "message": "Unauthorized",
            "data": None,
        })

    return JSONResponse({
        "status": HTTPStatus.OK,
        "message": "User permitted!",
        "data": None,
    })


@app.post(
    "/change_pass",
    response_model=StatusResponse,
    summary="Change password",
    description="Change admin password with new password.",
    tags=["Authentication"],
)
async def change_pass_route(
        request: Request,
        new_pass: str = Form(..., description="The new password"),
        bypass: bool = Depends(verify_bearer_token),
):
    session_data = request.session.get("user", {"permitted": False})

    if not (bypass or session_data.get("permitted")):
        return JSONResponse({
            "status": HTTPStatus.UNAUTHORIZED,
            "message": "Unauthorized",
            "data": None,
        })

    change_cred(new_pass)
    return JSONResponse({
        "status": HTTPStatus.OK,
        "message": "Password changed successfully!",
        "data": None,
    })


@app.post(
    "/create_record",
    response_model=ShortenedResponse,
    summary="Create a record",
    description="Create a shortened URL record with the given URL. Note that the URL must comes with protocol.",
    tags=["Record"],
)
async def create_record_route(
        url: str = Form(..., description="URL to shorten", examples=[""]),
        custom_keyword: str = Form(..., description="Custom keyword", examples=[""])
):
    status, keyword, message = create_record(url, custom_keyword)
    return JSONResponse({
        "status": status,
        "message": message,
        "data": {
            "shortened_key": keyword
        }
    })


@app.delete(
    "/delete_record",
    response_model=StatusResponse,
    summary="Delete a record",
    description=inspect.cleandoc("""
        Delete a shortened URL record with\n
            1) The shortened part without base-URL\n
            2) The full shortened URL with protocol\n
            3) The full shortened URl without protocol\n
            4) The original URL without protocol (will fill-in with https://)\n
            ) The original URL with protocol\n
        """),
    tags=["Record"],
)
async def delete_record_route(
        request: Request,
        url: str = Form(..., description="URL to put in search to be deleted"),
        bypass: bool = Depends(verify_bearer_token),
):
    session_data = request.session.get("user", {"permitted": False})
    if not (bypass or session_data.get("permitted")):
        return JSONResponse({
            "status": HTTPStatus.UNAUTHORIZED,
            "message": "Unauthorized",
            "data": None,
        })

    status, message  = delete_record(url)
    return JSONResponse({
        "status": status,
        "message": message,
        "data": None,
    })



@app.get(
    "/search_record",
    response_model=SearchResponse,
    summary="Search a record",
    description="Search for a record using the shortened part (without base-URL) of the shortened URL.",
    tags=["Record"],
)
async def search_record_route(
        short_key: str = Query(..., description="Short key to search", examples=[""]),
):
    status, message, result = search(short_key, query_type=UrlRowType.SHORT, response_type=UrlRowType.ORIG)
    return JSONResponse({
        "status": status,
        "message": message,
        "data": {
            "original_url": result
        },
    })


@app.get(
    "/get_all_records",
    response_model=GetRecordsResponse,
    summary="Get all records",
    description="Get all records from the database.",
    tags=["Record"],
)
def get_all_records_route(
        request: Request,
        bypass: bool = Depends(verify_bearer_token)
):
    session_data = request.session.get("user", {"permitted": False})
    if not (bypass or session_data.get("permitted")):
        return JSONResponse({
            "status": HTTPStatus.UNAUTHORIZED,
            "message": "Unauthorized",
            "data": None,
        })

    status, message, records = get_all_records()
    return JSONResponse({
        "status": status,
        "message": message,
        "data": {
            "records": records
        },
    })


@app.delete(
    "/delete_all_records",
    response_model=StatusResponse,
    summary="Purge all records",
    description="Purge all records from the database.",
    tags=["Record"],
)
def delete_all_records_route(
        request: Request,
        bypass: bool = Depends(verify_bearer_token)
):
    session_data = request.session.get("user", {"permitted": False})
    if not (bypass or session_data.get("permitted")):
        return JSONResponse({
            "status": HTTPStatus.UNAUTHORIZED,
            "message": "Unauthorized",
            "data": None,
        })

    delete_all_records()
    return JSONResponse({
        "status": HTTPStatus.OK,
        "message": "All records deleted!",
        "data": None,
    })


def init():
    """
    Initialize the database.
    """
    with sqlite3.connect(dbfile) as con:
        cur = con.cursor()

        del_forbidden_word(txtfile)
        sort_dict(txtfile)
        load_dictionary(con.commit, cur, txtfile)
        make_urls(con.commit, cur)
        make_login(con.commit, cur)


if __name__ == "__main__":
    # Initialize database if not exists
    if not os.path.exists(dbfile):
        print("Initializing database...")
        init()
        exit()

    # Reset password if file is_reset_password.txt is 1
    # The file is set by either user manually or by the setup.sh script
    with open(is_reset_password_file, 'r+') as f:
        if f.read().strip() == '1':
            with sqlite3.connect(dbfile) as con:
                cur = con.cursor()
                make_login(con.commit, cur)
                print("Password reset sucessfully!")
            f.seek(0)
            f.write('0')
            f.truncate()

    uvicorn.run("app:app", host="0.0.0.0", port=8000)
    # uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True, log_level="trace") # for debugging
