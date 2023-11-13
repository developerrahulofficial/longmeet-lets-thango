import * as React from 'react';
import { db, analytics } from '../../libs';
import { config } from '../../shared';
import './Room.css';
import { CustomizedAlert } from '../';
import { ActionButtons } from './ActionButtons';
import { Video } from './Video';
import { useHistory, useLocation } from 'react-router';
import VolumeOffSharpIcon from '@material-ui/icons/VolumeOffSharp';
import VolumeUpSharpIcon from '@material-ui/icons/VolumeUpSharp';
import VideocamSharpIcon from '@material-ui/icons/VideocamSharp';
import VideocamOffSharpIcon from '@material-ui/icons/VideocamOffSharp';
import Tooltip from '@material-ui/core/Tooltip';
import Fab from '@material-ui/core/Fab';

import {
  Session,
  ConnectType,
  Peer,
  Offer,
  CastDevices,
  User,
  ALERT_TYPE,
  CALL_TYPE
} from '../../interfaces';
import { useAlert } from '../../hooks';
import * as ROUTES from '../../routes';
import { logger } from '../../utils';

const { useRef, useEffect, useState } = React;

export const Room = () => {
  const clipboardRef = useRef<HTMLInputElement>(null);
  const localVideo = useRef<HTMLVideoElement>(null);
  const shareVideo = useRef<HTMLVideoElement>(null);
  const shareContainer = useRef<HTMLDivElement>(null);
  const videoContainer = useRef<HTMLDivElement>(null);
  const session = useRef<Session>({});
  const globalListeners = useRef<Function[]>([]);
  const localStream = useRef<MediaStream>(new MediaStream());
  const shareStream = useRef<MediaStream>(new MediaStream());
  const callID = useRef<string>('');
  const callType = useRef<keyof typeof CALL_TYPE>(CALL_TYPE.video);
  const user = useRef<string>('');
  const userName = useRef<string>('');
  const location = useLocation();
  const history = useHistory();
  const { openAlert, setAlertMessage, setOpenAlert, alertMessage, alertType, fireAlert} = useAlert();
  const [sessionState, setSessionState] = useState<Session>({});
  const [mute, setMute] = useState<boolean>(false);
  const [webcam, setWebcam] = useState<boolean>(false);
  const [isSharing, setIsSharing] = useState<boolean>(false);

  const addToSession = (key: string, peer: Peer) => {
    if (session.current[key]) {
      logger(`Duplicate key ${key}`);
      deleteSessionByKey(key);
      addToSession(key, peer);
    }
    else {
      session.current[key] = peer;
      setSessionState((currentSession) => {
        return ({
          ...currentSession,
          [key]: peer
        })
      });
    }
    logger(session.current);
  }
  const deleteSessionByKey = (key: string) => {
    if (session.current[key]) {
      logger(`Deleting ${key}`);
      session.current[key].pc.close();
      session.current[key].listeners.forEach((listener) => listener());
      delete session.current[key];
      setSessionState(session.current);
    }
    else {
      logger(`${key} does not exist.`);
    }
  }

  useEffect(() => {

    // Interval to update videos
    // const interval = setInterval(sessionCallback, 1000);

    const main = async () => {
      try {
        if (!location.state) {
          fireAlert('Invalid State. Please join or create call via the appropriate screen.', ALERT_TYPE.error);

          setTimeout(() => {
            handleEndCall();
          }, 1500)
        }
        else {
          const state = location.state as { action: 'call' | 'answer', name: string, callID: string, callType: keyof typeof CALL_TYPE, userID: string };
          callID.current = state.callID;
          user.current = state.userID;
          userName.current = state.name;
          callType.current = state.callType;
          switch (state.action) {
            case 'call': {
              await handleWebcam(callType.current);
              await handleCall();
              break;
            }
            case 'answer': {
              await handleWebcam(callType.current);
              await handleAnswer();
            }
          }

          // If it's a reload, nuke state
          history.replace({ pathname: ROUTES.ROOM, state: undefined });
        }
      }
      catch (error) {
        logger(error);
        setAlertMessage('Call Failed. Please exit and create a new call.')
        setOpenAlert(true);
      }
    }
    main();

    return () => {
      // clearInterval(interval);
      // Undo as many listeners as possibe
      // eslint-disable-next-line
      Object.keys(session.current).forEach((key) => {
        // peer.listeners.forEach((listener) => listener());
        deleteSessionByKey(key);
      });
      // eslint-disable-next-line
      globalListeners.current.forEach((listener) => listener());
    }
  // eslint-disable-next-line
  }, []);

  const createOfferPeer = async (call: string, userID: string, peerID: string, name: string, stream: MediaStream, type = ConnectType.user) => {
    const sessionKey = type === ConnectType.user ? peerID : `share_to_offer_${peerID}`;

    if (!session.current[sessionKey]) {
      // Socket Connections
      const callDoc = db.collection('calls').doc(call);
      const userDoc = callDoc.collection('users').doc(userID);
      const offers = userDoc.collection('offers').doc(peerID);
      const answers = userDoc.collection('answers').doc(peerID);
      const offerCandidates = userDoc.collection('offerCandidates').doc(peerID).collection('candidates');
      const answerCandidates = userDoc.collection('answerCandidates').doc(peerID).collection('candidates');

      const peer: Peer = {
        name,
        peerID: sessionKey,
        pc: new RTCPeerConnection(config.servers),
        remoteStream: new MediaStream(),
        listeners: [],
        type
      };

      // Push tracks from local stream to peer connection
      stream.getTracks().forEach((track) => {
        peer.pc.addTrack(track, stream);
      });
      peer.pc.ontrack = (e) => {
        e.streams.forEach((stream) => {
          stream.getTracks().forEach((track) => {
            peer.remoteStream.addTrack(track);
          })
        });
      }

      // Handle disconnect
      peer.pc.onconnectionstatechange = (e) => {
        switch (peer.pc.connectionState) {
        case "disconnected":
          {
            deletePeerConnection(sessionKey, peer);
            break;
          }
        case "closed":
          { 
            deletePeerConnection(sessionKey, peer);
            break;
          }
        case "failed":
          { 
            deletePeerConnection(sessionKey, peer);
            break;
          }
        }
      }

      // Handle Ice Candidate
      peer.pc.onicecandidate = (e) => {
        e.candidate && offerCandidates.add(e.candidate.toJSON());
      }

      const offerDescription = await peer.pc.createOffer();
      await peer.pc.setLocalDescription(offerDescription);

      const offer: RTCSessionDescriptionInit = {
        sdp: offerDescription.sdp,
        type: offerDescription.type
      }
      // Push offer to user's specific record
      await offers.set({ offer });

      // Handle when someone answers
      let listener = answers.onSnapshot((snapshot) => {
        if (snapshot.exists) {
          const { answer } = snapshot.data() as { answer: RTCSessionDescription };
          const answerDescription = new RTCSessionDescription(answer);
          if (peer.pc.signalingState !== 'closed') {
            try {
              peer.pc.setRemoteDescription(answerDescription);
            }
            catch (error) {
              logger(error);
            }
          }
          else {
            listener();
            // delete session.current[sessionKey];
            deleteSessionByKey(sessionKey);
          }
        }
      });
      peer.listeners.push(listener);

      // Handle when answerers provide answer candidates
      listener = answerCandidates.onSnapshot((snapshot) => {
        snapshot.docChanges().map(async (change) => {
          if (change.type === 'added') {
            const candidate = new RTCIceCandidate(change.doc.data());
            if (peer.pc.signalingState !== 'closed') {
              try {
                await peer.pc.addIceCandidate(candidate);
              }
              catch (error) {
                logger(error);
              }
            }
            else {
              if (peer.type === 'share') {
                  deleteSessionByKey('screen');
                  deleteSessionByKey('share_to_answer_screen');
                  deleteSessionByKey('share_to_offer_screen');
              }
              deleteSessionByKey(sessionKey);
            }
          }
        })
      });
      peer.listeners.push(listener);

      // Update session list
      // session.current[sessionKey] = peer;
      // setSessionState((currrentValue) => {
      //   return {
      //     ...currrentValue,
      //     [sessionKey]: peer
      //   }  
      // })
      addToSession(sessionKey, peer);

      if (peerID !== userID && type !== ConnectType.share) {
        createVideoComponent(peer, type);
      }

      return peer;
    }
    return session.current[peerID];
  }

  const createVideoComponent = (peer: Peer, type: ConnectType) => {
    if (type === ConnectType.share) {
      setIsSharing(true);
      shareStream.current.getTracks().forEach((track) => track.stop());
      if (shareVideo.current !== null) {
        shareVideo.current.muted = false;
        shareVideo.current.volume = process.env.NODE_ENV === 'development' ? 0 : 0.2;
        shareVideo.current.srcObject = peer.remoteStream;
      }
      else {
        let shareVideoEl = document.querySelector('#shareVideo') as HTMLVideoElement;
        shareVideoEl.muted = false;
        shareVideoEl.volume = process.env.NODE_ENV === 'development' ? 0 : 0.2;
        shareVideoEl.srcObject = peer.remoteStream;
      }
    }
  };

  const handleWebcam = async (callType: keyof typeof CALL_TYPE) => {
    try {
      const constraints: { video?: boolean, audio?: boolean } = {
        video: false,
        audio: true
      };
      const devices = await navigator.mediaDevices.enumerateDevices();

      devices.forEach((device) => {
        if (device.kind === 'videoinput' && callType !== CALL_TYPE.audio) constraints.video = true;
      });
      if (constraints.video) setWebcam(true);

      localStream.current = await navigator.mediaDevices.getUserMedia(constraints);
    }
    catch (error) {
      logger(error);
      fireAlert('Failed to access Webcam and/or Mic', ALERT_TYPE.error);
    }

    localVideo.current!.volume = 0;
    localVideo.current!.srcObject = localStream.current;
  }

  const handleCall = async () => {
    // Create the room and add you as the first user with no peer connection at all
    logger(`Call ID: ${callID.current}`);
    const callDoc = db.collection('calls').doc(callID.current);
    await callDoc.set({ time: new Date(), callType: callType.current });
    const userDoc = callDoc.collection('users').doc(user.current);
    const usersCollection = callDoc.collection('users');
    await userDoc.set({ name: userName.current, type: ConnectType.user, time: new Date(), status: 'active', mute: mute });
    const screenDoc = callDoc.collection('users').doc('screen');

    // Watch for new users to come in and create new peer connection
    let listener = usersCollection.onSnapshot(async (snapshot) => {
      const promises = snapshot.docChanges()
        .filter((change) => user.current !== change.doc.id)
        .map(async (change) => {
          if (change.type === 'added') {
            const existingUserID = change.doc.id;
            logger(existingUserID);
            if (!session.current[existingUserID]) {
              const u = change.doc.data();
              
              if (u.type === ConnectType.user) {
                logger(`User ${u.name} joined the call`);
                fireAlert(`User ${u.name} joined the call`, ALERT_TYPE.success);
                await createOfferPeer(callID.current, user.current, existingUserID, u.name, localStream.current);

                // If sharing, then create offer for share stream too
                const sharingCondition = Object.keys(session.current).reduce((accumulator: boolean, currrentValue: string) => {
                  if (currrentValue.indexOf('share_to_offer') !== -1) {
                    return accumulator || true;
                  }
                  return accumulator;
                }, false);
                if (sharingCondition) {
                  await createOfferPeer(callID.current, 'screen', existingUserID, u.name, shareStream.current, ConnectType.share);
                }
              }
              else if (u.type === ConnectType.share) {
                if (u.shareID !== user.current) {
                  logger(`User ${u.shareUserName} is sharing their screen`);
                  fireAlert(`User ${u.shareUserName} is sharing their screen`, ALERT_TYPE.success);

                  // Close your sharing if exist
                  shareStream.current.getTracks().forEach((track) => track.stop());
                }
                else {
                  logger(`You are sharing your screen`);
                  fireAlert(`You are sharing your screen`, ALERT_TYPE.success);
                }
              }
            }
          }
        });
      
      await Promise.all(promises);
    });
    globalListeners.current.push(listener);

    // Socket to monitor who will share screen
    listener = screenDoc.collection('offers').onSnapshot(async (snapshot) => {
      const promises = snapshot.docChanges()
        .filter((change) => change.doc.id === user.current)
        .map(async (change) => {
        // const id = change.doc.id;
        logger('Anticipating share screen');
        // Clean up 'screen' session
        Object.keys(session.current).forEach((key) => {
          if (session.current[key].type === ConnectType.share) {
            // session.current[key].listeners.forEach((listener) => listener());
            // session.current[key].pc.close();
            // delete session.current[key];
            deleteSessionByKey(key);
          }
        })
        if (change.type === 'added') {
          const { offer } = change.doc.data() as Offer;
          const answerPeer = await createAnswerPeer(callID.current, user.current, 'screen', 'Screen', offer, new MediaStream(), ConnectType.share);
          // const listener = screenDoc.collection('offerCandidates').doc(user.current).collection('candidates').onSnapshot((ss) => {
          //   ss.docChanges().forEach(async (cc) => {
          //     if (cc.type === 'added') {
          //       let data = cc.doc.data();
          //       if (answerPeer.pc.signalingState !== 'closed') {
          //         try {
          //           await answerPeer.pc.addIceCandidate(new RTCIceCandidate(data));
          //         }
          //         catch (error) {
          //           logger(error);
          //         }
          //       }
          //       else {
          //         listener();
          //         deleteSessionByKey('screen');
          //         deleteSessionByKey('share_to_answer_screen');
          //         deleteSessionByKey('share_to_offer_screen');
          //       }
          //     }
          //   });
          // });
          // answerPeer.listeners.push(listener);
        }
      });

      await Promise.all(promises);
    });
    globalListeners.current.push(listener);
  }

  const deletePeerConnection = (key: string, peer: Peer) => {
    logger(`Connection Disconnected - ${peer.name}`);
    deleteSessionByKey(key);
    if (peer.type === ConnectType.user) {
      fireAlert(`${peer.name} disconnected.`, ALERT_TYPE.info);
    }

    [
      `share_to_offer_${peer.peerID}`,
      // `share_to_offer_screen`,
      `share_to_answer_${peer.peerID}`,
      // `share_to_answer_screen`,
    ].forEach((key) => {
      deleteSessionByKey(key);
    });
  }

  const createAnswerPeer = async (call: string, userID: string, offerID: string, name: string, offer: RTCSessionDescriptionInit, stream: MediaStream, type = ConnectType.user) => {
    const callDoc = db.collection('calls').doc(call);
    const userDoc = callDoc.collection('users').doc(offerID);
    const answers = userDoc.collection('answers').doc(userID);
    const offerCandidates = userDoc.collection('offerCandidates').doc(offerID).collection('candidates');
    const answerCandidates = userDoc.collection('answerCandidates').doc(userID).collection('candidates');

    const sessionKey = type === ConnectType.user ? offerID : `share_to_answer_${offerID}`;

    const peer: Peer = {
      name,
      peerID: sessionKey,
      pc: new RTCPeerConnection(config.servers),
      remoteStream: new MediaStream(),
      listeners: [],
      type
    };

    // Handle Ice Candidate
    peer.pc.onicecandidate = (e) => {
      e.candidate && answerCandidates.add(e.candidate.toJSON());
    }
    // Push stream from local to remote
    stream.getTracks().forEach((track) => {
      peer.pc.addTrack(track, stream);
    });
    // Handle Remote Stream
    peer.pc.ontrack = (e) => {
      e.streams.forEach((stream) => {
        stream.getTracks().forEach((track) => {
          peer.remoteStream.addTrack(track)     
        })
      });
    }
    // Handle disconnect
    peer.pc.onconnectionstatechange = (e) => {
      switch (peer.pc.connectionState) {
        case "disconnected":
          {
            deletePeerConnection(sessionKey, peer);
            break;
          }
        case "closed":
          { 
            deletePeerConnection(sessionKey, peer);
            break;
          }
        case "failed":
          { 
            deletePeerConnection(sessionKey, peer);
            break;
          }
      }
    }

    await peer.pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answerDescription = await peer.pc.createAnswer();
    if (peer.type === 'share') {
      if (answerDescription.sdp) {
        answerDescription.sdp.replace('useinbandfec=1', 'useinbandfec=1; stereo=1; maxaveragebitrate=510000');
      }
    }
    await peer.pc.setLocalDescription(answerDescription);
    const answer: RTCSessionDescriptionInit = {
      sdp: answerDescription.sdp,
      type: answerDescription.type
    };
    await answers.set({ answer });

    // Handle when offerers provide answer candidates
    const listener = offerCandidates.onSnapshot(async (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          let data = change.doc.data();
          if (peer.pc.signalingState !== 'closed') {
            try {
              await peer.pc.addIceCandidate(new RTCIceCandidate(data));
            }
            catch (error) {
              logger(error);
            }
          }
          else {
            const sessionKey = peer.type === ConnectType.user ? offerID : `share_to_answer_${offerID}`;
            deleteSessionByKey(sessionKey);
            // delete session.current[sessionKey];
          }
        }
      })
    });
    peer.listeners.push(listener);

    addToSession(sessionKey, peer);

    if (offerID !== userID) {
      createVideoComponent(peer, type);
    }
    return peer;
  }

  const handleAnswer = async () => {
    logger(`Call ID: ${callID.current}`);
    // Add yourself to the list of uers
    const callDoc = db.collection('calls').doc(callID.current);
    const testCall = await callDoc.get();
    if (!testCall.exists) {
      fireAlert('Invalid Call ID. Please try again with a valid one.', ALERT_TYPE.error);
      return;
    }

    const userDoc = callDoc.collection('users').doc(user.current);
    await userDoc.set({ name: userName.current, type: ConnectType.user, time: new Date(), status: 'active', mute: mute });
    const usersCollection = callDoc.collection('users');
    const screenDoc = callDoc.collection('users').doc('screen');

    // Go through all existing users and connect to them using their offer for your user ID
    const promises = (await usersCollection.get()).docs
      .filter((u) => u.id !== user.current)
      .map(async (doc) => {
        const id = doc.id;
        const u = doc.data() as User;

        doc.ref.collection('offers').doc(user.current).onSnapshot(async (snapshot) => {
          if (snapshot.exists) {
            if (u.type !== ConnectType.share) {
              logger(`Retrieving offers from ${id} -- ${u.name}`);
              const { offer } = snapshot.data() as Offer;
              const answerPeer = await createAnswerPeer(callID.current, user.current, id, u.name, offer, localStream.current);

              // const listener = doc.ref.collection('offerCandidates').doc(user.current).collection('candidates').onSnapshot((snapshot) => {
              //   snapshot.docChanges().forEach(async (change) => {
              //     if (change.type === 'added') {
              //       let data = change.doc.data();
              //       if (answerPeer.pc.signalingState !== 'closed') {
              //         try {
              //           await answerPeer.pc.addIceCandidate(new RTCIceCandidate(data));
              //         }
              //         catch (error) {
              //           logger(error);
              //         }
              //       }
              //       else {
              //         listener();
              //         const sessionKey = answerPeer.type === ConnectType.user ? id : `share_to_answer_${id}`;
              //         deleteSessionByKey(sessionKey);
              //         // delete session.current[sessionKey];
              //       }
              //     }
              //   });
              // });
              // answerPeer.listeners.push(listener);
            }
          }
        })
      });
    await Promise.all(promises);

    // Watch for new users to come in and create new peer connection
    let listener = usersCollection.onSnapshot(async (snapshot) => {
      if (Object.keys(session.current).length > 0) {
        const promises = snapshot.docChanges()
          .filter((change) => user.current !== change.doc.id)
          .map(async (change) => {
            if (change.type === 'added') {
              const existingUserID = change.doc.id;
              if (!session.current[existingUserID]) {
                const u = change.doc.data();
                if (u.type === ConnectType.user) {
                  logger(`User ${u.name} joined the call`);
                  fireAlert(`User ${u.name} joined the call`, ALERT_TYPE.success);
                  await createOfferPeer(callID.current, user.current, existingUserID, u.name, localStream.current);

                  // If sharing, then create offer for share stream too
                  const sharingCondition = Object.keys(session.current).reduce((accumulator: boolean, currrentValue: string) => {
                    if (currrentValue.indexOf('share_to_offer') !== -1) {
                      return accumulator || true;
                    }
                    return accumulator;
                  }, false);
                  if (sharingCondition) {
                    await createOfferPeer(callID.current, 'screen', existingUserID, u.name, shareStream.current, ConnectType.share);
                  }
                }
                else if (u.type === ConnectType.share) {
                  if (u.shareID !== user.current) {
                    logger(`User ${u.shareUserName} is sharing their screen`);
                    fireAlert(`User ${u.shareUserName} is sharing their screen`, ALERT_TYPE.success);
                    // Close your sharing if exist
                    shareStream.current.getTracks().forEach((track) => track.stop());
                  }
                  else {
                    logger(`You are sharing your screen`);
                    fireAlert(`You are sharing your screen`, ALERT_TYPE.success);
                  }
                }
              }
            }
          });
      
        await Promise.all(promises);
      }
    });
    globalListeners.current.push(listener);

    // Socket to monitor who will share screen
    listener = screenDoc.collection('offers').onSnapshot(async (snapshot) => {
      const promises = snapshot.docChanges()
        .filter((change) => change.doc.id === user.current)
        .map(async (change) => {
        // const id = change.doc.id;
        logger('Anticipating share screen');
        // Clean up 'screen' session
        Object.keys(session.current).forEach((key) => {
          if (session.current[key].type === ConnectType.share) {
            // session.current[key].listeners.forEach((listener) => listener());
            // session.current[key].pc.close();
            // delete session.current[key];
            deleteSessionByKey(key);
          }
        })
        if (change.type === 'added') {
          const { offer } = change.doc.data() as Offer;
          const answerPeer = await createAnswerPeer(callID.current, user.current, 'screen', 'Screen', offer, new MediaStream(), ConnectType.share);
          const listener = screenDoc.collection('offerCandidates').doc(user.current).collection('candidates').onSnapshot((ss) => {
            ss.docChanges().forEach(async (cc) => {
              if (cc.type === 'added') {
                let data = cc.doc.data();
                if (answerPeer.pc.signalingState !== 'closed') {
                  try {
                    await answerPeer.pc.addIceCandidate(new RTCIceCandidate(data));
                  }
                  catch (error) {
                    logger(error);
                  }
                }
                else {
                  listener();
                  deleteSessionByKey('screen');
                  deleteSessionByKey('share_to_answer_screen');
                  deleteSessionByKey('share_to_offer_screen');
                }
              }
            });
          });
          answerPeer.listeners.push(listener);
        }
      });

      await Promise.all(promises);
    });
    globalListeners.current.push(listener);
  }

  const handleShareScreen = async () => {
    if (Object.keys(session.current).length === 0) {
      fireAlert('Cannot share screen in empty room. Please wait for more folks to join.', ALERT_TYPE.info);
      return;
    }

    // Turn on sharing screen view
    setIsSharing(true);

    try {
      shareStream.current.getTracks().forEach((track) => track.stop());

      const castDevices = navigator.mediaDevices as CastDevices;
      shareStream.current = await castDevices.getDisplayMedia({
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
          latency: 0,
          channelCount: 2,
          sampleRate: 48000,
          sampleSize: 16
        },
        video: {
          frameRate: 60
        }
      });
      shareVideo.current!.muted = false;
      shareVideo.current!.volume = 0;
      shareVideo.current!.srcObject = shareStream.current;

      const callDoc = db.collection('calls').doc(callID.current);
      const userDoc = callDoc.collection('users').doc(`screen`);

      // Clean up 'screen' session
      Object.keys(session.current).forEach((key) => {
        if (session.current[key].type === ConnectType.share) {
          deleteSessionByKey(key);
          // session.current[key].listeners.forEach((listener) => listener());
          // session.current[key].pc.close();
          // delete session.current[key];
        }
      })

      // Delete Screen record. Will need to move to cloud function later
      const _offers = await userDoc.collection('offers').get();
      _offers.docs.forEach((_offer) => _offer.ref.delete());
      const _offerCandidates = await userDoc.collection('offerCandidates').get();
      let _ps = _offerCandidates.docs.map(async (_offerCandidate) => {
        const candidates = await _offerCandidate.ref.collection('candidates').get();
        candidates.forEach((candidate) => candidate.ref.delete());
      });
      await Promise.all(_ps);
      const _answers = await userDoc.collection('answers').get();
      _answers.docs.forEach((_answer) => _answer.ref.delete());
      const _answerCandidates = await userDoc.collection('answerCandidates').get();
      _ps = _answerCandidates.docs.map(async (_answerCandidate) => {
        const candidates = await _answerCandidate.ref.collection('candidates').get();
        candidates.forEach((candidate) => candidate.ref.delete());
      });
      await Promise.all(_ps);
      await userDoc.delete();

      // Update screen user
      await userDoc.set({ name: 'Screen Share', type: ConnectType.share, shareID: user.current, shareUserName: userName.current, time: new Date(), status: 'active', mute: false });

      // Create offers and candidates for each user
      // const promises = (await callDoc.collection('users').get()).docs
      //   .filter((doc) => user.current !== doc.id && doc.data().type !== ConnectType.share)
      //   .map(async (doc) => {
      //   const existingUserID = doc.id;
      //   const data = doc.data() as User;
      //   await createOfferPeer(callID.current, 'screen', existingUserID, data.name, shareStream.current, ConnectType.share);
      // });
      // await Promise.all(promises);
      Object.values(session.current)
        .filter((peer) => peer.type !== ConnectType.share && user.current !== peer.peerID)
        .forEach((peer) => {
          createOfferPeer(callID.current, 'screen', peer.peerID, peer.name, shareStream.current, ConnectType.share);
        })

      // Analytics
      analytics.logEvent('share_screen', {
        name: userName.current,
        callID: callID.current,
        userID: user.current
      });
      // Socket to create new peers for sharing when new user join in as well
      // Clear current listener so we don't pile on them
      // shareUserListener.current();
      // const usersCollection = callDoc.collection('users');
      // shareUserListener.current = usersCollection.onSnapshot(async (snapshot) => {
      //   const ps = snapshot.docChanges()
      //     .filter((change) => !session.current[change.doc.id] && change.doc.id !== user.current && change.doc.data().type !== ConnectType.share)
      //     .map(async (change) => {
      //       if (change.type === 'added') {
      //           const newUserID = change.doc.id;
      //           const data = change.doc.data() as User;
      //           await createOfferPeer(callID.current, 'screen', newUserID, data.name, shareStream.current, ConnectType.share);
      //       }
      //     });

      //   await Promise.all(ps);
      // });
    }
    catch (error) {
      logger(error);
      fireAlert('Failed to share screen. Please rejoin and try again.', ALERT_TYPE.error);
      setIsSharing(false);
    }
  }

  const handleRoomID = () => {
    if (clipboardRef.current) {
      if (clipboardRef.current.value.length > 0) {
        clipboardRef.current.select();
        document.execCommand('copy');
        fireAlert(`Call ID copied into clipboard.`, ALERT_TYPE.info);
      }
    }
  }

  const handleMute = async () => {
    localStream.current.getAudioTracks().forEach((track) => track.enabled = mute);

    await db.collection('calls').doc(callID.current).collection('users').doc(user.current).update({ mute: !mute });
    setMute(!mute);
  }

  const handleEndCall = () => {
    shareStream.current.getTracks().forEach((track) => track.stop());
    localStream.current.getTracks().forEach((track) => track.stop());

    Object.keys(session.current).forEach((key) => {
      deleteSessionByKey(key);
    });
    globalListeners.current.forEach((listener) => listener());

    // Analytics
    analytics.logEvent('end_call', {
      name: userName.current,
      callID: callID.current,
      userID: user.current
    });

    fireAlert('Ending call...', ALERT_TYPE.info);
    setTimeout(() => {
      history.push(ROUTES.JOIN);
    }, 2000);
  };

  const toggleWebcam = async () => {
    if (!webcam) {
      localStream.current.getVideoTracks().forEach((videoTrack) => videoTrack.enabled = true);
      localVideo.current!.srcObject = localStream.current;
    }
    else {
      localStream.current.getVideoTracks().forEach((videoTrack) => videoTrack.enabled = false);
      localVideo.current!.srcObject = null;
    }

    setWebcam(!webcam);
  }

  return (
    <>
      <div id="roomContainer" className={isSharing ? 'sharing' : 'standalone'}>
        {
          isSharing
          ? (
            <div id='shareContainer' ref={shareContainer}>
              <div className="videos">
                <span>
                  <video id="shareVideo" ref={shareVideo} autoPlay playsInline muted></video>
                </span>
              </div>
              <ActionButtons
                shareVideoRef={shareVideo}
                handleRoomID={handleRoomID}
                handleShareScreen={handleShareScreen}
                handleEndCall={handleEndCall}
              />
            </div>
          )
          : ''
        }
        <div ref={videoContainer} id='videoContainer'>
          {
            Object.values(
              sessionState
            )
              .filter((peer) => peer.peerID !== user.current && peer.type !== ConnectType.share)
              .map((peer) => <Video key={peer.peerID} peer={peer} callID={callID.current} />)
          }

          {/* <Video peer={{
            name: 'Dummy 1',
            peerID: '12',
            pc: new RTCPeerConnection(config.servers),
            remoteStream: new MediaStream(),
            listeners: [],
            type: ConnectType.user
          }} callID={''} /> */}

          {/* <Video peer={{
            name: 'Dummy 2',
            peerID: '13',
            pc: new RTCPeerConnection(config.servers),
            remoteStream: new MediaStream(),
            listeners: [],
            type: ConnectType.user
          }} callID={''} />

          <Video peer={{
            name: 'Dummy 2',
            peerID: '13',
            pc: new RTCPeerConnection(config.servers),
            remoteStream: new MediaStream(),
            listeners: [],
            type: ConnectType.user
          }} callID={''} /> */}

          <div className="videos" id='localVideoContainer'>
            <span>
              <video id="localVideo" ref={localVideo} autoPlay playsInline poster={`${process.env.PUBLIC_URL}/user_placeholer.`}></video>
            </span>
            <div className='name'>
              <div>
                {userName.current}
              </div>
              <div>
                <Tooltip title={mute ? 'Unmute' : 'Mute' } placement='top' onClick={handleMute}>
                  {
                    mute ? <VolumeOffSharpIcon fontSize='small'/> : <VolumeUpSharpIcon fontSize='small'/>
                  } 
                </Tooltip>
              </div>
            </div>
            <div className='action'>
              <Tooltip title={mute ? 'Unmute' : 'Mute' } placement='bottom'>
                <Fab aria-label='mute_toggle' size='small' onClick={handleMute}>
                  {
                    mute ? <VolumeOffSharpIcon fontSize='small'/> : <VolumeUpSharpIcon fontSize='small'/>
                  }
                </Fab>
              </Tooltip>
              &nbsp;
              <Tooltip title={webcam ? 'Camera Off' : 'Camera On' } placement='bottom'>
                <Fab aria-label='webcam_toggle' size='small' onClick={toggleWebcam}>
                  {
                    webcam ? <VideocamOffSharpIcon fontSize='small'/> : <VideocamSharpIcon fontSize='small'/>
                  }
                </Fab>
              </Tooltip>
            </div>
          </div>
        </div>

        {
          !isSharing
          ? (
            <div id='standalone_share'>
              <ActionButtons
                shareVideoRef={shareVideo}
                handleRoomID={handleRoomID}
                handleShareScreen={handleShareScreen}
                handleEndCall={handleEndCall}
              />
            </div>
          )
          : ''
        }

      </div>
      <input id="clipboard" ref={clipboardRef} value={callID.current} onChange={() => {}}/>
      <CustomizedAlert duration={5000} openAlert={openAlert} setOpenAlert={setOpenAlert} alertMessage={alertMessage} alertType={alertType}/>
    </>
  )
}