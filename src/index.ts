import { CronJob } from "cron";
import { backup } from "./backup.js";
import { env } from "./env.js";
import { applyRetentionPolicy } from "./retention.js";

console.log("NodeJS Version: " + process.version);

const tryBackup = async () => {
  try {
    await backup();
  } catch (error) {
    console.error("Error while running backup: ", error);
    process.exit(1);
  }
}

const tryRetention = async () => {
  try {
    await applyRetentionPolicy();
  } catch (error) {
    console.error("Error while running retention policy: ", error);
    process.exit(1);
  }
}

if (env.RUN_ON_STARTUP || env.SINGLE_SHOT_MODE) {
  console.log("Running on start backup...");

  await tryBackup();

  if (env.SINGLE_SHOT_MODE) {
    console.log("Database backup complete, exiting...");
    process.exit(0);
  }
}

const job = new CronJob(env.BACKUP_CRON_SCHEDULE, async () => {
  await tryBackup();
});

job.start();

console.log("Backup cron scheduled...");

// Add daily retention policy job only if RETENTION_DAYS is set
if (env.RETENTION_DAYS && env.RETENTION_DAYS > 0) {
  const retentionJob = new CronJob("0 0 * * *", async () => {
    await tryRetention();
  });
  retentionJob.start();
  console.log("Retention cron scheduled...");
} else {
  console.log("Retention policy not configured. Skipping daily retention job.");
}
