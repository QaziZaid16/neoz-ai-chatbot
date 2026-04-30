# 1. Base Python image
FROM python:3.10-slim

# 2. Install ffmpeg for Audio Processing (Yeh error fix karega!)
RUN apt-get update && apt-get install -y ffmpeg

# 3. Setup working directory
WORKDIR /app

# 4. Copy and install Python libraries
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 5. Copy the rest of your Python code
COPY . .

# 6. Command to run the server on Render's Port
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}