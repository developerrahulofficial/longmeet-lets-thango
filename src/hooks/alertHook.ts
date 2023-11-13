import * as React from 'react';
import { ALERT_TYPE } from '../interfaces';

const useAlert = () => {
  const [openAlert, setOpenAlert] = React.useState<boolean>(false);
  const [alertType, setAlertType] = React.useState<keyof typeof ALERT_TYPE>(ALERT_TYPE.error);
  const [alertMessage, setAlertMessage] = React.useState<string>('Unexpected Error. Please try again later!');

  const fireAlert = (message: string, type: ALERT_TYPE) => {
    setAlertType(type);
    setAlertMessage(message);
    setOpenAlert(true);
  }

  return {
    openAlert,
    setOpenAlert,
    alertType,
    setAlertType,
    alertMessage,
    setAlertMessage,
    fireAlert
  };
}

export default useAlert;