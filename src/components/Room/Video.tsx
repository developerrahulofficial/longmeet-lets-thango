import * as React from 'react';
import Slider from '@material-ui/core/Slider';
import { Peer } from '../../interfaces';
import Grid from '@material-ui/core/Grid';
import VolumeDown from '@material-ui/icons/VolumeDown';
import VolumeOffSharpIcon from '@material-ui/icons/VolumeOffSharp';
import makeStyles from '@material-ui/core/styles/makeStyles';
import Tooltip from '@material-ui/core/Tooltip';

import { db } from '../../libs';
import {
  User
} from '../../interfaces';

const { useRef, useEffect, useState, memo } = React;

const useStyles = makeStyles({
  slider: {
    width: 100,
  },
});

interface VideoProp {
  peer: Peer,
  callID: string
}

export const Video = memo(({
  peer,
  callID
}: VideoProp) => {
  const classes = useStyles();
  const videoRef = useRef<HTMLVideoElement>(null)
  const videoID = `#video_${peer.peerID.split('-')[0]}`;
  const [value, setValue] = useState<number>(process.env.NODE_ENV === 'development' ? 0 : 0.2);

  useEffect(() => {
    videoRef.current!.srcObject = peer.remoteStream;
    videoRef.current!.volume = process.env.NODE_ENV === 'development' ? 0 : 0.2;
  }, [peer.remoteStream])

  const handleChange = (event: any, newValue: number | number[]) => {
    setValue(newValue as number);
    if (videoRef.current) {
      videoRef.current.volume = newValue as number;
    }
  };

  const handlePIP = () => {
    if (videoRef.current) {
    }
  }

  return (
    <div className={`videos ${videoID.slice(1,)}`}>
      <span>
        <video width='100%' id={videoID} ref={videoRef} autoPlay playsInline onDoubleClick={handlePIP}></video>
      </span>
      <div className='name'>
        <div>
          {peer.name}
        </div>
        <MuteIcon peer={peer} callID={callID}/>
      </div>
      <Grid className='action' container spacing={2} justify='center' alignContent='center' alignItems='center'>
        <Tooltip title='Volume' placement='top'>
          <VolumeDown />
        </Tooltip>
        <Grid item className={classes.slider}>
          <Slider value={value} onChange={handleChange} aria-labelledby="continuous-slider" min={0} max={1} step={0.1} />
        </Grid>
      </Grid>
    </div>
  )
});

const MuteIcon = memo(({
  peer,
  callID
}: VideoProp) => {
  const [mute, setMute] = useState<boolean>(false);
  
  useEffect(() => {
    if (callID.length > 0) {
      const unsubscribe = db.collection('calls').doc(callID).collection('users').doc(peer.peerID).onSnapshot((snapshot) => {
        const data = snapshot.data() as User;
        setMute(data.mute);
      });

      return () => unsubscribe();
    }
  }, [peer.remoteStream, callID, peer.peerID])

  return (
    <div>
      <Tooltip title={mute ? '' : 'Mute' } placement='top'>
        {
          mute ? <VolumeOffSharpIcon fontSize='small'/> : <></>
        } 
      </Tooltip>
    </div>
  )
});