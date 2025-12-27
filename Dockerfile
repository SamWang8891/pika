FROM python:3.14.2-alpine3.23

WORKDIR /app

COPY docker/backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# The first run should initialize the database
CMD [ "python", "./app.py" ]