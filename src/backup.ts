import { exec } from "child_process";
import { PutObjectCommand, S3Client, S3ClientConfig } from "@aws-sdk/client-s3";
import { createReadStream, unlink } from "fs";

import { env } from "./env";

const uploadToS3 = async ({ name, path, basePath }: {name: string, path: string, basePath?: string}) => {
  console.log("Uploading backup to S3...");

  const bucket = env.AWS_S3_BUCKET;

  const clientOptions: S3ClientConfig = {
    region: env.AWS_S3_REGION,
  }

  if (env.AWS_S3_ENDPOINT) {
    console.log(`Using custom endpoint: ${env.AWS_S3_ENDPOINT}`)
    clientOptions['endpoint'] = env.AWS_S3_ENDPOINT;
  }

  const client = new S3Client(clientOptions);

  const key = basePath ? `${basePath}/${name}` : name;
  console.log(`Backup uploading to ${key}`);

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: createReadStream(path),
    })
  )

  console.log("Backup uploaded to S3...");
}

const dumpToFile = async (path: string) => {
  console.log("Dumping DB to file...");

  await new Promise((resolve, reject) => {
    exec(
      `pg_dump ${env.BACKUP_DATABASE_URL} -F t | gzip > ${path}`,
      (error, stdout, stderr) => {
        if (error) {
          reject({ error: JSON.stringify(error), stderr });
          return;
        }

        resolve(undefined);
      }
    );
  });

  console.log("DB dumped to file...");
}

const deleteFile = async (path: string) => {
  console.log("Deleting file...");
  await new Promise((resolve, reject) => {
    unlink(path, (err) => {
      reject({ error: JSON.stringify(err) });
      return;
    });
    resolve(undefined);
  })
}

export const backup = async (basePath?: string) => {
  console.log("Initiating DB backup...")

  let date = new Date().toISOString()
  const timestamp = date.replace(/[:.]+/g, '-')
  const filename = `backup-${timestamp}.tar.gz`
  const filepath = `/tmp/${filename}`

  await dumpToFile(filepath)
  await uploadToS3({name: filename, path: filepath, basePath})
  await deleteFile(filepath)

  console.log("DB backup complete...")
}
