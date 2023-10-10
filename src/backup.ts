import { exec } from "child_process";
import { Storage, UploadOptions } from "@google-cloud/storage";
import { unlink } from "fs";

import { env } from "./env";

const uploadToGCS = async ({ name, path }: { name: string; path: string }) => {
  console.log("Uploading backup to GCS...");

  const bucketName = env.GCS_BUCKET;

  const uploadOptions: UploadOptions = {
    destination: name,
  };

    const storage = new Storage({
        projectId: env.GOOGLE_PROJECT_ID,
        credentials: JSON.parse(env.SERVICE_ACCOUNT_JSON),
    });

  await storage.bucket(bucketName).upload(path, uploadOptions);

  console.log("Backup uploaded to GCS...");
};

const dumpToFile = async (path: string) => {
  console.log("Dumping DB to file...");

  await new Promise((resolve, reject) => {
    exec(
      `pg_dump ${env.BACKUP_DATABASE_URL} -F t | gzip > ${path}`,
      (error, _, stderr) => {
        if (error) {
          reject({ error: JSON.stringify(error), stderr });
          return;
        }

        resolve(undefined);
      }
    );
  });

  console.log("DB dumped to file...");
};

const deleteFile = async (path: string) => {
  console.log("Deleting file...");
  await new Promise((resolve, reject) => {
    unlink(path, (err) => {
      reject({ error: JSON.stringify(err) });
      return;
    });
    resolve(undefined);
  });
};

export const backup = async () => {
  console.log("Initiating DB backup...");

  let date = new Date().toISOString();
  const timestamp = date.replace(/[:.]+/g, "-");
  const filename = `${env.BACKUP_PREFIX}backup-${timestamp}.tar.gz`;
  const filepath = `/tmp/${filename}`;

  await dumpToFile(filepath);
  await uploadToGCS({ name: filename, path: filepath });
  await deleteFile(filepath);

  console.log("DB backup complete...");
};
