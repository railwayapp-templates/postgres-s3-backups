import axios from 'axios';
import { env } from './env.js';

export const notifyError = async (message: string) => {
  if (env.ON_ERROR_NOTIFY_URL) {
    try {
      new URL(env.ON_ERROR_NOTIFY_URL); // This will throw an error if the URL is invalid
    } catch (error) {
      console.error(`Invalid ON_ERROR_NOTIFY_URL: ${env.ON_ERROR_NOTIFY_URL}`);
      return;
    }

    const url = new URL(env.ON_ERROR_NOTIFY_URL);
    url.searchParams.append('message', message);

    try {
      console.log("Sending error notification...");
      await axios.get(url.toString());
    } catch (error) {
      console.error(`Failed to send error notification: ${error}`);
    }
  }
}
