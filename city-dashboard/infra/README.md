# infra/

AWS setup scripts for CarbinWatcher. Fill in `setup.sh` with real AWS CLI calls.

## Resources to provision

1. **IoT Core** — thing + certificate + policy; attach cert to thing
2. **Firehose** — delivery stream from IoT Core rule → S3 (`$S3_BUCKET`)
3. **S3** — bucket `carbinwatcher-raw` with server-side encryption + lifecycle policy
4. **DynamoDB** — table `carbinwatcher-state` (pk: `user_id`, sk: `item_id`)
5. **SES** — verified sender identity (`$SES_SENDER_EMAIL`)
6. **SNS** — topic `carbinwatcher-alerts` with email/SMS subscriptions
7. **App Runner** — service pulling from GitHub, running `backend/main.py`
8. **Databricks** — external location on the S3 bucket, catalog + schema + Delta tables (bronze/silver/gold)

## IAM notes

- App Runner service role needs: DynamoDB RW, SES SendEmail, SNS Publish
- IoT rule role needs: firehose:PutRecordBatch
- Firehose role needs: s3:PutObject on the bucket

## Usage

```bash
export AWS_REGION=us-west-2
./setup.sh
```

Script is idempotent — safe to re-run.
