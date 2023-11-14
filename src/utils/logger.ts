import { config } from '../shared';

const logger = (msg: any) => {
  if (config.DEV) {
    console.log(msg);
  }
}

export default logger;