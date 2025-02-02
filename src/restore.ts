import { exec, execSync } from "child_process";
import {
  S3Client,
  GetObjectCommand,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { createWriteStream, statSync } from "fs";
import path from "path";
import os from "os";
import { Readable } from "stream";
import { finished } from "stream/promises";
import { URL } from "url";

import { env } from "./env.js";
import { deleteFile } from "./backup.js";

const downloadFromS3 = async (fileName: string, filePath: string) => {
  console.log("Downloading backup from S3...");

  const clientOptions: S3ClientConfig = {
    region: env.AWS_S3_REGION,
    forcePathStyle: env.AWS_S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  };

  if (env.AWS_S3_ENDPOINT) {
    clientOptions.endpoint = env.AWS_S3_ENDPOINT;
  }

  const client = new S3Client(clientOptions);
  let key = fileName;

  if (env.BUCKET_SUBFOLDER) {
    key = `${env.BUCKET_SUBFOLDER}/${fileName}`;
  }

  const command = new GetObjectCommand({
    Bucket: env.AWS_S3_BUCKET,
    Key: key,
  });

  const response = await client.send(command);
  const stream = response.Body as Readable;
  const writer = createWriteStream(filePath);

  await finished(stream.pipe(writer));
  console.log("Backup downloaded from S3");
};

const validateBackupFile = (filePath: string) => {
  console.log("Validating backup file...");
  try {
    execSync(`gzip -t ${filePath}`);
    return true;
  } catch (error) {
    console.error("validateBackupFile err", error);
    throw new Error("Invalid backup file: File is not a valid gzip archive");
  }
};

const estimateRestoreTime = (filePath: string) => {
  const stats = statSync(filePath);
  const sizeMB = stats.size / (1024 * 1024);
  const estimatedMinutes = Math.ceil(sizeMB / 100); // 100 MB/min throughput
  console.log(`Estimated restore time: ~${estimatedMinutes} minutes`);
};

const resetDatabase = async (databaseUrl: string) => {
  console.log("Resetting database...");
  const parsedUrl = new URL(databaseUrl);
  const dbName = parsedUrl.pathname.slice(1);
  const rootUrl = databaseUrl.replace(parsedUrl.pathname, "/postgres");

  await new Promise((resolve, reject) => {
    exec(
      `psql ${rootUrl} -c "SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = '${dbName}' AND pid <> pg_backend_pid();"`,
      (error, stdout, stderr) => {
        if (error) reject({ error, stderr });
        resolve(undefined);
      }
    );
  });

  await new Promise((resolve, reject) => {
    exec(
      `psql ${rootUrl} -c "DROP DATABASE IF EXISTS ${dbName}"`,
      (error, stdout, stderr) => {
        if (error) reject({ error, stderr });
        resolve(undefined);
      }
    );
  });

  await new Promise((resolve, reject) => {
    exec(
      `psql ${rootUrl} -c "CREATE DATABASE ${dbName}"`,
      (error, stdout, stderr) => {
        if (error) reject({ error, stderr });
        resolve(undefined);
      }
    );
  });

  console.log("Database reset complete");
};

const restoreDatabase = async (filePath: string, databaseUrl: string) => {
  console.log("Restoring database...");
  await new Promise((resolve, reject) => {
    exec(
      `gzip -cd ${filePath} | pg_restore --clean --if-exists --no-owner --no-privileges --dbname=${databaseUrl}`,
      (error, stdout, stderr) => {
        if (error) {
          reject({ error, stderr });
          return;
        }
        resolve(undefined);
      }
    );
  });
  console.log("Database restore completed");
};

export const restore = async () => {
  console.log("Initiating DB restore...");

  if (!env.RESTORE_DATABASE_URL || !env.RESTORE_FILE_NAME) {
    throw new Error(
      "Restore requires RESTORE_DATABASE_URL and RESTORE_FILE_NAME environment variables"
    );
  }

  const filepath = path.join(os.tmpdir(), env.RESTORE_FILE_NAME);

  try {
    await downloadFromS3(env.RESTORE_FILE_NAME, filepath);
    validateBackupFile(filepath);
    estimateRestoreTime(filepath);
    await resetDatabase(env.RESTORE_DATABASE_URL);
    await restoreDatabase(filepath, env.RESTORE_DATABASE_URL);
  } finally {
    try {
      await deleteFile(filepath);
    } catch (err) {
      console.error("Error cleaning up temporary file:", err);
    }
  }

  console.log("DB restore complete");
};
