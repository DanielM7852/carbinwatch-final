# edge/

Arduino UNO Q (Linux side) + MCU + Logitech USB webcam + Modulino Pixels/Buzzer/Vibro.

## What goes here

- Inference code (YOLO or MobileNet) running on the UNO Q Linux side, consuming webcam frames
- MCU sketch driving Modulino feedback (pixel ring for category, buzzer for confirmation, vibro for alerts)
- MQTT publisher sending classification events to AWS IoT Core

## Suggested structure (fill in)

```
edge/
├── linux/           # Python inference + IoT Core publisher
│   ├── detect.py
│   ├── iot_publish.py
│   └── requirements.txt
└── mcu/             # PlatformIO project for Modulino feedback
    ├── platformio.ini
    └── src/main.cpp
```

## Event shape

Publish to topic `carbinwatcher/<thing_name>/classifications`:

```json
{
  "ts": "2025-04-18T12:34:56Z",
  "user_id": "u1",
  "item": "banana peel",
  "category": "compost",
  "confidence": 0.87,
  "weight_kg_est": 0.12
}
```
