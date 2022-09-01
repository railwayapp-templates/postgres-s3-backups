import { CronJob } from "cron";

import { backup } from "./backup";
import { env } from "./env";

const job = new CronJob(env.BACKUP_CRON_SCHEDULE, async () => {
  try {
    await backup();
  } catch (error) {
    console.error("Error while running backup: ", error)
  }
});

job.start();

console.log("Backup cron scheduled...")
