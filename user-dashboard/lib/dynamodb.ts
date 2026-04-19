import { DynamoDBClient, type DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

/** Trim and strip optional surrounding quotes — paste errors cause InvalidSignatureException. */
function normalizeEnv(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  let v = value.trim();
  if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
    v = v.slice(1, -1).trim();
  }
  return v.length > 0 ? v : undefined;
}

const region =
  normalizeEnv(process.env.AWS_REGION) ||
  normalizeEnv(process.env.AWS_DEFAULT_REGION) ||
  "us-east-1";

const accessKeyId = normalizeEnv(process.env.AWS_ACCESS_KEY_ID);
const secretAccessKey = normalizeEnv(process.env.AWS_SECRET_ACCESS_KEY);

/**
 * If `aws dynamodb list-tables` works but this app gets InvalidSignature, your `.env.local`
 * keys often do not match what the CLI uses. Set `AWS_USE_CLI_CREDENTIALS=true` and remove the
 * two key lines so we use the same default chain as the AWS CLI (`~/.aws/credentials`, SSO, etc.).
 */
const useCliCredentials =
  normalizeEnv(process.env.AWS_USE_CLI_CREDENTIALS) === "1" ||
  normalizeEnv(process.env.AWS_USE_CLI_CREDENTIALS)?.toLowerCase() === "true";

const config: DynamoDBClientConfig = { region };

if (accessKeyId && secretAccessKey && !useCliCredentials) {
  config.credentials = { accessKeyId, secretAccessKey };
} else {
  config.credentials = defaultProvider();
}

const client = new DynamoDBClient(config);

export const docClient = DynamoDBDocumentClient.from(client);
