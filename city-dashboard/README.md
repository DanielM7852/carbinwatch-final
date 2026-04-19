# CarbinWatcher

Smart kitchen waste auditor. Classifies items into food waste / recycling / landfill / compost at the edge, streams events to AWS, surfaces impact metrics via a Gemini-powered chat assistant.

## Stack

- **Edge:** Arduino UNO Q (Linux + MCU), Logitech webcam, Modulino Pixels/Buzzer/Vibro. Pretrained object detection (YOLO or MobileNet).
- **Cloud:** AWS IoT Core → Firehose → S3. DynamoDB for current state. SES/SNS for alerts.
- **Analytics:** Databricks reading Delta tables on S3.
- **Backend:** FastAPI with a Gemini agent and tool functions.
- **Frontend:** Next.js (live feed, impact dashboard, chat).
- **Deploy:** AWS App Runner.

## Repo layout

```
edge/        UNO Q firmware + inference code
backend/     FastAPI app (main.py) + Gemini agent + venv
frontend/    Next.js app (scaffold with create-next-app)
infra/       AWS setup scripts
notebooks/   EDA / prototyping notebooks
```

## Quickstart — backend

```bash
cd backend
source venv/bin/activate
cp ../.env.example ../.env   # then fill in real values
python main.py               # serves on http://localhost:8000
```

Health check: `curl http://localhost:8000/health`
Chat: `curl -X POST http://localhost:8000/chat -H "Content-Type: application/json" -d '{"message":"how am I doing?","user_id":"u1"}'`

## Quickstart — frontend

```bash
cd frontend
npx create-next-app@latest . --typescript --tailwind --app --eslint --no-src-dir --import-alias "@/*"
npm run dev                  # http://localhost:3000
```

## Env vars

See [`.env.example`](.env.example). Required secrets: `AWS_*`, `AWS_IOT_ENDPOINT`, `DATABRICKS_TOKEN`, `GEMINI_API_KEY`.
