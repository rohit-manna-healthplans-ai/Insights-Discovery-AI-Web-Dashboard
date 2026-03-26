# Discovery Agent API (Flask)
FROM python:3.12-slim-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY run.py .

ENV PYTHONUNBUFFERED=1
EXPOSE 5000

# WSGI server; use 2 workers for small deployments
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--threads", "4", "--timeout", "120", "run:app"]
