import { exec } from "child_process";
import { S3Client, S3ClientConfig } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { createReadStream, unlink, statSync } from "fs";
import { filesize } from "filesize";
import path from "path";
import os from "os";

import { env } from "./env";

const uploadToS3 = async ({ name, path }: { name: string, path: string }) => {
  console.log("Uploading backup to S3...");

  const bucket = env.AWS_S3_BUCKET;

  const clientOptions: S3ClientConfig = {
    region: env.AWS_S3_REGION
  }

  if (env.AWS_S3_ENDPOINT) {
    console.log(`Using custom endpoint: ${env.AWS_S3_ENDPOINT}`)
    clientOptions['endpoint'] = env.AWS_S3_ENDPOINT;
  }

  const client = new S3Client(clientOptions);

  await new Upload({
    client,
    params: {
      Bucket: bucket,
      Key: name,
      Body: createReadStream(path),
    },
  }).done();

  console.log("Backup uploaded to S3...");
}

const dumpToFile = async (filePath: string) => {
  console.log("Dumping DB to file...");

  await new Promise((resolve, reject) => {
    exec(`pg_dump --dbname=${env.BACKUP_DATABASE_URL} --format=tar | gzip > ${filePath}`, (error, stdout, stderr) => {
      if (error) {
        reject({ error: error, stderr: stderr.trimEnd() });
        return;
      }

      // not all text in stderr will be a critical error, print the error / warning
      if (stderr != "") {
        console.log({ stderr: stderr.trimEnd() });
      }

      const backupSize = statSync(filePath).size;

      console.log("Backup size:", filesize(backupSize));

      // if stderr did contain a critical error the resulting dumb file's size would be sub 100 bytes
      if (backupSize < 100) {
        reject({error: "Backup size does not meet size threshold; check for errors above"});
        return;
      }

      // if stderr contains text, but the dumb file is not empty, let the user know that it was potently just a warning message
      if (stderr != "" && backupSize > 100) {
        console.log(`Warnings detected; Please ensure the backup file "${path.basename(filePath)}" is valid`);
      }

      resolve(undefined);
    });
  });

  console.log("DB dumped to file...");
}

const deleteFile = async (path: string) => {
  console.log("Deleting file...");
  await new Promise((resolve, reject) => {
    unlink(path, (err) => {
      reject({ error: err });
      return;
    });
    resolve(undefined);
  });
}

export const backup = async () => {
  console.log("Initiating DB backup...");

  let date = new Date().toISOString();
  const timestamp = date.replace(/[:.]+/g, '-');
  const filename = `backup-${timestamp}.tar.gz`;
  const filepath = path.join(os.tmpdir(), filename);

  await dumpToFile(filepath);
  await uploadToS3({ name: filename, path: filepath });
  await deleteFile(filepath);

  console.log("DB backup complete...");
}
