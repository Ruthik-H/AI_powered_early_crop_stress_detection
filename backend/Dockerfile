FROM python:3.11-slim

WORKDIR /app

# Install system deps for GDAL/Rasterio
RUN apt-get update && apt-get install -y \
    gcc g++ libgdal-dev gdal-bin \
    libpq-dev python3-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p uploads ai_model

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
