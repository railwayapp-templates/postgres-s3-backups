import axios from 'axios';
import { env } from './env.js';

export const notifyError = async (message: string) => {
  if (env.ERROR_NOTIFY_URL) {
    try {
      new URL(env.ERROR_NOTIFY_URL); // This will throw an error if the URL is invalid
    } catch (error) {
      console.error(`Invalid ERROR_NOTIFY_URL: ${env.ERROR_NOTIFY_URL}`);
      return;
    }

    const url = new URL(env.ERROR_NOTIFY_URL);
    url.searchParams.append('message', message);

    try {
      await axios.get(url.toString());
    } catch (error) {
      console.error(`Failed to send error notification: ${error}`);
    }
  }
}
