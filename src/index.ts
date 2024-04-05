import { CronJob } from "cron";
import { backup } from "./backup.js";
import { env } from "./env.js";

console.log("NodeJS Version: " + process.version);

const tryBackup = async () => {
  try {
    await backup();
  } catch (error) {
    console.error("Error while running backup: ", error);
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