// Local S3-compatible storage (RustFS) standing in for Cloudflare R2 in dev, cloud sessions and tests
// (ADR 0009 / issue #6). Creates the bucket and CORS rules. Refuses non-local endpoints.
import { S3Client, CreateBucketCommand, PutBucketCorsCommand, HeadBucketCommand } from "@aws-sdk/client-s3";

export const LOCAL_STORAGE = {
  endpoint: "http://127.0.0.1:55340",
  accessKeyId: "mixdown-dev",
  secretAccessKey: "mixdown-dev-secret", // fixed local-only credentials, like Supabase's demo keys
  bucket: "mixdown-local",
};

const s3 = new S3Client({
  region: "us-east-1",
  endpoint: LOCAL_STORAGE.endpoint,
  forcePathStyle: true,
  credentials: { accessKeyId: LOCAL_STORAGE.accessKeyId, secretAccessKey: LOCAL_STORAGE.secretAccessKey },
});

async function waitForServer() {
  for (let i = 0; i < 30; i++) {
    try {
      await s3.send(new HeadBucketCommand({ Bucket: LOCAL_STORAGE.bucket }));
      return true;
    } catch (e) {
      if (e?.$metadata?.httpStatusCode === 404 || e?.name === "NotFound") return false; // up, no bucket yet
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error(`Local storage at ${LOCAL_STORAGE.endpoint} didn't start`);
}

const exists = await waitForServer();
if (!exists) await s3.send(new CreateBucketCommand({ Bucket: LOCAL_STORAGE.bucket }));
await s3.send(
  new PutBucketCorsCommand({
    Bucket: LOCAL_STORAGE.bucket,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: ["http://localhost:3000", "http://127.0.0.1:3000"],
          AllowedMethods: ["GET", "PUT", "HEAD"],
          AllowedHeaders: ["content-type", "range"],
          ExposeHeaders: ["ETag", "Content-Length", "Content-Range", "Accept-Ranges"],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  }),
);
console.log(`storage: bucket ${LOCAL_STORAGE.bucket} ${exists ? "exists" : "created"} at ${LOCAL_STORAGE.endpoint}`);
