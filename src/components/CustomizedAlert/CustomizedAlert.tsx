import * as React from 'react';
import Snackbar from '@material-ui/core/Snackbar';
import MuiAlert, { AlertProps } from '@material-ui/lab/Alert';
import { makeStyles, Theme } from '@material-ui/core/styles';
import { ALERT_TYPE } from '../../interfaces';

const Alert: React.FC<AlertProps> = (props: AlertProps) => {
  return <MuiAlert elevation={6} variant="filled" {...props} />;
}

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    width: '100%',
    '& > * + *': {
      marginTop: theme.spacing(2),
    },
  },
}));

export const CustomizedAlert: React.FC<{
  duration?: number,
  openAlert: boolean,
  setOpenAlert: React.Dispatch<React.SetStateAction<boolean>>,
  alertMessage: string,
  alertType: keyof typeof ALERT_TYPE
}> = ({ duration, openAlert, setOpenAlert, alertType, alertMessage }) => {
  const classes = useStyles();

  const handleClose = (event?: React.SyntheticEvent, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpenAlert(false);
  };

  return (
    <div className={classes.root}>
      <Snackbar open={openAlert} autoHideDuration={duration} onClose={handleClose}>
        <Alert onClose={handleClose} severity={alertType}>
          { alertMessage }
        </Alert>
      </Snackbar>
    </div>
  );
}