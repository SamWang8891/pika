from pydantic import BaseModel


class StatusResponse(BaseModel):
    message: str
    data: None


class ShortenedSchemas(BaseModel):
    shortened_key: str | None


class ShortenedResponse(BaseModel):
    message: str
    data: ShortenedSchemas | None


class SearchSchemas(BaseModel):
    original_url: str | None


class SearchResponse(BaseModel):
    message: str
    data: SearchSchemas | None


class GetRecordsSchemas(BaseModel):
    records: list[dict[str, str | None]]


class GetRecordsResponse(BaseModel):
    message: str
    data: GetRecordsSchemas | None
