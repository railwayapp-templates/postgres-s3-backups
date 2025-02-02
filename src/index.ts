import { CronJob } from "cron";
import { backup } from "./backup.js";
import { restore } from "./restore.js";
import { env } from "./env.js";

console.log("NodeJS Version: " + process.version);

const tryBackup = async () => {
  try {
    await backup();
  } catch (error) {
    console.error("Error while running backup: ", error);
    process.exit(1);
  }
};

if (env.RUN_MODE === "restore") {
  console.log("Starting database restore...");
  try {
    await restore();
    console.log("Restore completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("Restore failed:", error);
    process.exit(1);
  }
} else if (env.RUN_ON_STARTUP || env.SINGLE_SHOT_MODE) {
  console.log("Running on start backup...");

  await tryBackup();

  if (env.SINGLE_SHOT_MODE) {
    console.log("Database backup complete, exiting...");
    process.exit(0);
  }
}

const job =
  env.RUN_MODE === "backup"
    ? new CronJob(env.BACKUP_CRON_SCHEDULE, async () => {
        await tryBackup();
      })
    : null;

if (job) {
  job.start();
  console.log("Backup cron scheduled...");
}
