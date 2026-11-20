import "server-only";
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Object storage for audio (ADR 0003). Cloudflare R2 in hosted environments; a local
// S3-compatible server (RustFS, started by `npm run db:start`) when R2_ENDPOINT is set.
// This is the ONLY module that may read R2 credentials.

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}. See apps/web/.env.example.`);
  return value;
}

let client: S3Client | undefined;

function s3(): S3Client {
  if (client) return client;
  const localEndpoint = process.env.R2_ENDPOINT;
  client = new S3Client({
    region: localEndpoint ? "us-east-1" : "auto",
    endpoint: localEndpoint ?? `https://${required("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    forcePathStyle: Boolean(localEndpoint),
    credentials: {
      accessKeyId: required("R2_ACCESS_KEY_ID"),
      secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
    },
    // Don't add SDK checksum parameters to presigned URLs; the browser can't compute them.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return client;
}

const bucket = () => required("R2_BUCKET");

/**
 * Presigned PUT valid for 15 minutes. Content-Type and Content-Length are part of the signature,
 * so storage rejects any other type or size. (The SDK signs only content-length by default.)
 */
export async function presignUpload(key: string, contentType: string, size: number): Promise<string> {
  return getSignedUrl(
    s3(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType, ContentLength: size }),
    { expiresIn: 15 * 60, signableHeaders: new Set(["content-type", "content-length"]) },
  );
}

/** Size and type of a stored object, or null if it doesn't exist. */
export async function statObject(key: string): Promise<{ size: number; contentType?: string } | null> {
  try {
    const head = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return { size: head.ContentLength ?? 0, contentType: head.ContentType };
  } catch (e) {
    if ((e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return null;
    throw e;
  }
}

/** Presigned GET valid for 1 hour, for <audio> playback (issue #7). */
export async function presignPlayback(key: string): Promise<string> {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn: 60 * 60 });
}
