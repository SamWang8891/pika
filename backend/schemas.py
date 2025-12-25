from pydantic import BaseModel


class StatusResponse(BaseModel):
    message: str
    data: None


class ShortenedSchemas(BaseModel):
    shortened_key: str


class ShortenedResponse(BaseModel):
    message: str
    data: ShortenedSchemas


class SearchSchemas(BaseModel):
    original_url: str


class SearchResponse(BaseModel):
    message: str
    data: SearchSchemas | None


class GetRecordsSchemas(BaseModel):
    records: dict[str, str]


class GetRecordsResponse(BaseModel):
    message: str
    data: GetRecordsSchemas | None
