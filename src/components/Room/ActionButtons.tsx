import * as React from 'react';
import Fab from '@material-ui/core/Fab';
import ScreenShareSharpIcon from '@material-ui/icons/ScreenShareSharp';
import RoomSharpIcon from '@material-ui/icons/RoomSharp';
import './ActionButtons.css';
import Grid from '@material-ui/core/Grid';
import VolumeDown from '@material-ui/icons/VolumeDown';
import FullscreenSharpIcon from '@material-ui/icons/FullscreenSharp';
import FullscreenExitSharpIcon from '@material-ui/icons/FullscreenExitSharp';
import CallEndSharpIcon from '@material-ui/icons/CallEndSharp';
import Slider from '@material-ui/core/Slider';
import makeStyles from '@material-ui/core/styles/makeStyles';
import Tooltip from '@material-ui/core/Tooltip';

const { useState, useEffect, useCallback } = React;

const useStyles = makeStyles({
  root: {
    width: 200,
  },
});

interface ActionProps {
  shareVideoRef: React.RefObject<HTMLVideoElement>,
  handleShareScreen: () => Promise<void>,
  handleRoomID: () => void,
  handleEndCall: () => void,
}

export const ActionButtons = (props: ActionProps) => {
  const {
    shareVideoRef,
    handleShareScreen,
    handleRoomID,
    handleEndCall
  } = props;
  const classes = useStyles();
  const [value, setValue] = useState<number>(process.env.NODE_ENV === 'development' ? 0 : 0.2);
  const [fullScreen, setFullScreen] = useState<boolean>(false);

  const fullScreenCallback = useCallback(() => {
    if (document.fullscreenElement) {
      setFullScreen(true);
    }
    else {
      setFullScreen(false);
    }
  }, [])

  useEffect(() => {
    document.addEventListener('fullscreenchange', fullScreenCallback);

    return () => document.removeEventListener('fullscreenchange', fullScreenCallback);
  }, [fullScreenCallback]);

  const handleFullScreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    else {
      document.documentElement.requestFullscreen();
    }
  }

  const handleChange = (event: any, newValue: number | number[]) => {
    setValue(newValue as number);
    if (shareVideoRef.current) {
      shareVideoRef.current.volume = newValue as number;
    }
  };

  return (
    <div id='actionContainer'>
      <Grid container spacing={2} justify='center' alignContent='center' alignItems='center'>
        <Grid item>
          <Tooltip title='End Call' placement='top'>
            <Fab aria-label='room_id' onClick={handleEndCall} color='secondary'><CallEndSharpIcon /></Fab>
          </Tooltip>
        </Grid>
        <Grid item>
          <Tooltip title='Copy Call ID' placement='top'>
            <Fab aria-label='room_id' onClick={handleRoomID}><RoomSharpIcon /></Fab>
          </Tooltip>
        </Grid>
        <Grid item>
          <Tooltip title='Share Screen' placement='top'>
            <Fab aria-label='share' onClick={handleShareScreen}><ScreenShareSharpIcon /></Fab>
          </Tooltip>
        </Grid>
        <Grid item>
          <Tooltip title='Volume' placement='top'>
            <VolumeDown />
          </Tooltip>
        </Grid>
        <Grid item className={classes.root}>
          <Slider value={value} onChange={handleChange} aria-labelledby="continuous-slider" min={0} max={1} step={0.1}/>
        </Grid>
        <Grid item id='fullScreenIcon'>
          <Tooltip title='' placement='top' onClick={handleFullScreen}>
            {
              fullScreen
              ? <FullscreenExitSharpIcon />
              : <FullscreenSharpIcon />
            }
          </Tooltip>
        </Grid>
      </Grid>
    </div>
  )
}