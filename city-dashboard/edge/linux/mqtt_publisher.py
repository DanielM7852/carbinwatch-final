"""MQTT publisher for CarbinWatcher edge devices.

Publishes classification events to AWS IoT Core over mTLS. The IoT rule
`carbinwatcher_to_firehose` fans out to DynamoDB (live state) and Firehose → S3.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

from awscrt import mqtt
from awsiot import mqtt_connection_builder

log = logging.getLogger(__name__)


class MqttPublisher:
    def __init__(
        self,
        iot_endpoint: str,
        thing_name: str,
        cert_path: str,
        key_path: str,
        root_ca_path: str,
        topic: str,
    ) -> None:
        self._endpoint = iot_endpoint
        self._thing = thing_name
        self._topic = topic
        self._conn = mqtt_connection_builder.mtls_from_path(
            endpoint=iot_endpoint,
            cert_filepath=os.path.expanduser(cert_path),
            pri_key_filepath=os.path.expanduser(key_path),
            ca_filepath=os.path.expanduser(root_ca_path),
            client_id=thing_name,
            clean_session=False,
            keep_alive_secs=30,
        )

    def connect(self) -> None:
        self._conn.connect().result(timeout=10)
        log.info("MQTT connected endpoint=%s thing=%s", self._endpoint, self._thing)

    def publish(self, event: dict[str, Any]) -> None:
        payload = json.dumps(event).encode()
        try:
            future, _ = self._conn.publish(
                topic=self._topic,
                payload=payload,
                qos=mqtt.QoS.AT_LEAST_ONCE,
            )
            future.result(timeout=5)
            log.info("Published topic=%s payload=%s", self._topic, event)
        except Exception as exc:
            log.error("Publish failed: %s payload=%s", exc, event)

    def disconnect(self) -> None:
        try:
            self._conn.disconnect().result(timeout=5)
            log.info("MQTT disconnected")
        except Exception as exc:
            log.warning("Disconnect error: %s", exc)
