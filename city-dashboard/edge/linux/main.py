"""CarbinWatcher edge simulator.

Fires random kitchen-waste classification events to AWS IoT Core at a fixed
interval. Run locally on a dev laptop to generate practice data for the demo;
replace the simulator loop with real webcam + YOLO inference later.
"""

from __future__ import annotations

import logging
import os
import random
import signal
import sys
import time
from datetime import datetime, timezone

from dotenv import load_dotenv

from mqtt_publisher import MqttPublisher

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
log = logging.getLogger("carbinwatcher.edge")

SAMPLES: list[tuple[str, str, tuple[float, float]]] = [
    ("banana peel",    "compost",    (0.08, 0.20)),
    ("coffee grounds", "compost",    (0.10, 0.30)),
    ("eggshells",      "compost",    (0.03, 0.10)),
    ("aluminum can",   "recycling",  (0.01, 0.02)),
    ("cardboard box",  "recycling",  (0.10, 0.50)),
    ("plastic wrap",   "landfill",   (0.01, 0.03)),
    ("spoiled yogurt", "food_waste", (0.15, 0.40)),
]


def build_event(user_id: str) -> dict:
    item, category, (vmin, vmax) = random.choice(SAMPLES)
    return {
        "ts": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "user_id": user_id,
        "item": item,
        "category": category,
        "confidence": round(random.uniform(0.70, 0.99), 2),
        "volume_l": round(random.uniform(vmin, vmax), 3),
    }


def main() -> int:
    load_dotenv()

    endpoint = os.environ["AWS_IOT_ENDPOINT"]
    thing = os.environ["AWS_IOT_THING_NAME"]
    cert = os.environ["AWS_IOT_CERT_PATH"]
    key = os.environ["AWS_IOT_KEY_PATH"]
    root_ca = os.environ["AWS_IOT_ROOT_CA_PATH"]
    user_id = os.getenv("EDGE_USER_ID", "u1")
    interval = float(os.getenv("EDGE_SIM_INTERVAL_S", "5"))
    topic = f"carbinwatcher/{thing.replace('carbinwatcher-', '', 1)}/classifications"

    publisher = MqttPublisher(
        iot_endpoint=endpoint,
        thing_name=thing,
        cert_path=cert,
        key_path=key,
        root_ca_path=root_ca,
        topic=topic,
    )
    publisher.connect()

    stopping = False

    def _stop(signum, frame):
        nonlocal stopping
        stopping = True
        log.info("Signal %s received — stopping after current publish", signum)

    signal.signal(signal.SIGINT, _stop)
    signal.signal(signal.SIGTERM, _stop)

    try:
        while not stopping:
            publisher.publish(build_event(user_id))
            for _ in range(int(interval * 10)):
                if stopping:
                    break
                time.sleep(0.1)
    finally:
        publisher.disconnect()

    return 0


if __name__ == "__main__":
    sys.exit(main())
