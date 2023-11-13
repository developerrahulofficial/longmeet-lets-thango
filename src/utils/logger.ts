import { config } from '../shared';

const logger = (msg: any) => {
  if (config.DEV || config.TEST) {
    console.log(msg);
  }
}

export default logger;