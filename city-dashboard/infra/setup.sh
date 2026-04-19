#!/usr/bin/env bash
# CarbinWatcher AWS provisioning — fill in each section.
# Idempotent: use --no-cli-pager and check-before-create patterns.
set -euo pipefail

: "${AWS_REGION:?AWS_REGION must be set}"

# ---------- 1. S3 bucket ----------
# aws s3api create-bucket --bucket carbinwatcher-raw --region "$AWS_REGION" ...

# ---------- 2. DynamoDB table ----------
# aws dynamodb create-table --table-name carbinwatcher-state ...

# ---------- 3. IoT Core thing + cert ----------
# aws iot create-thing --thing-name carbinwatcher-kitchen-01
# aws iot create-keys-and-certificate --set-as-active ...
# aws iot attach-policy --policy-name ... --target ...

# ---------- 4. Firehose delivery stream ----------
# aws firehose create-delivery-stream --delivery-stream-name carbinwatcher-ingest ...

# ---------- 5. IoT rule → Firehose ----------
# aws iot create-topic-rule --rule-name carbinwatcher_to_firehose ...

# ---------- 6. SES sender identity ----------
# aws ses verify-email-identity --email-address "$SES_SENDER_EMAIL"

# ---------- 7. SNS alert topic ----------
# aws sns create-topic --name carbinwatcher-alerts

# ---------- 8. App Runner service ----------
# aws apprunner create-service --service-name carbinwatcher-backend ...

echo "done (stub — fill in sections above)"
