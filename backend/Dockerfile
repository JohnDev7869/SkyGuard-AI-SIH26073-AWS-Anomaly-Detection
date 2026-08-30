FROM python:3.11-slim

WORKDIR /app

# Install dependencies for compilation if needed
RUN apt-get update && apt-get install -y --no-install-recommends build-essential

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# We don't copy all immediately in a production env, but for hackathon this is fine.
# We will mount the directory via docker-compose for live reload.
COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
