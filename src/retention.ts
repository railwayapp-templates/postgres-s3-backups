import {
  S3Client,
  S3ClientConfig,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { env } from "./env.js";

export const applyRetentionPolicy = async () => {
  if (env.RETENTION_DAYS <= 0) {
    console.log("Backup retention policy not set or disabled.");
    return;
  }

  console.log(
    `Applying retention policy: keeping backups for ${env.RETENTION_DAYS} days...`
  );
  const bucket = env.AWS_S3_BUCKET;
  const clientOptions: S3ClientConfig = {
    region: env.AWS_S3_REGION,
    forcePathStyle: env.AWS_S3_FORCE_PATH_STYLE,
  };
  if (env.AWS_S3_ENDPOINT) {
    clientOptions.endpoint = env.AWS_S3_ENDPOINT;
  }

  const client = new S3Client(clientOptions);
  const prefix = env.BUCKET_SUBFOLDER ? `${env.BUCKET_SUBFOLDER}/` : "";
  const retentionDate = new Date();
  retentionDate.setDate(retentionDate.getDate() - env.RETENTION_DAYS);

  const listParams = {
    Bucket: bucket,
    Prefix: prefix,
  };

  try {
    let objectsToDelete: { Key: string }[] = [];
    let isTruncated = true;
    let continuationToken: string | undefined;

    while (isTruncated) {
      const listCommand = new ListObjectsV2Command({
        ...listParams,
        ContinuationToken: continuationToken,
      });
      const data = await client.send(listCommand);

      if (data.Contents) {
        const expiredObjects = data.Contents.filter(
          (object) =>
            object.LastModified &&
            object.LastModified < retentionDate &&
            object.Key
        ).map((object) => ({ Key: object.Key! }));

        objectsToDelete.push(...expiredObjects);
      }

      isTruncated = !!data.IsTruncated;
      continuationToken = data.NextContinuationToken;

      // If we've accumulated 1000 objects or more, delete them in a batch
      if (objectsToDelete.length >= 1000) {
        await deleteExpiredObjects(client, bucket, objectsToDelete);
        objectsToDelete = [];
      }
    }

    // Delete any remaining objects
    if (objectsToDelete.length > 0) {
      await deleteExpiredObjects(client, bucket, objectsToDelete);
    }
  } catch (error) {
    console.error("Error while applying retention policy:", error);
  }

  console.log("Retention policy applied successfully.");
};

async function deleteExpiredObjects(
  client: S3Client,
  bucket: string,
  objects: { Key: string }[]
) {
  const deleteParams = {
    Bucket: bucket,
    Delete: { Objects: objects },
  };

  try {
    const deleteCommand = new DeleteObjectsCommand(deleteParams);
    const deleteResult = await client.send(deleteCommand);
    console.log(`Deleted ${deleteResult.Deleted?.length} expired backups.`);
    if (deleteResult.Errors && deleteResult.Errors.length > 0) {
      console.error("Some objects could not be deleted:", deleteResult.Errors);
    }
  } catch (error) {
    console.error("Error deleting expired objects:", error);
  }
}