from pydantic import BaseModel


class StatusResponse(BaseModel):
    status: bool
    message: str
    data: None


class ShortenedSchemas(BaseModel):
    shortened_key: str


class ShortenedResponse(BaseModel):
    status: bool
    message: str
    data: ShortenedSchemas


class SearchSchemas(BaseModel):
    original_url: str


class SearchResponse(BaseModel):
    status: bool
    message: str
    data: SearchSchemas | None


class GetRecordsSchemas(BaseModel):
    records: dict[str, str]


class GetRecordsResponse(BaseModel):
    status: bool
    message: str
    data: GetRecordsSchemas | None
