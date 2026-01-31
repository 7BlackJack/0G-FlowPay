# Build stage for 0g-storage-client
FROM golang:1.23 as builder

WORKDIR /build
# Clone the repository
RUN git clone https://github.com/0glabs/0g-storage-client.git .
# Build the binary
RUN go build -o 0g-storage-client main.go

# Runtime stage
FROM python:3.11-slim

WORKDIR /app

# Install git and other system dependencies if needed
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Copy python requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy 0g-storage-client binary from builder
COPY --from=builder /build/0g-storage-client /usr/local/bin/0g-storage-client
RUN chmod +x /usr/local/bin/0g-storage-client

# Copy application code
COPY . .

# Set environment variables
ENV ZG_STORAGE_CLIENT_PATH=/usr/local/bin/0g-storage-client
ENV PYTHONUNBUFFERED=1

# Expose port (Render/Railway will override PORT, but good to document)
EXPOSE 5001

# Run the application
# Use gunicorn or similar in production ideally, but for now app.py directly is fine for a demo
CMD ["python", "provider-agent/app.py"]
