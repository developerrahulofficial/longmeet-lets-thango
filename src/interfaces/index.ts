export interface Offer {
  offer: RTCSessionDescriptionInit
};
export interface Answer {
  answer: RTCSessionDescriptionInit
};

export interface CastDevices extends MediaDevices {
  getDisplayMedia: (constraints?: MediaStreamConstraints | undefined) => Promise<MediaStream>
}

export enum ConnectType {
  user = 'user',
  share = 'share'
};

export interface User {
  name: string,
  time: Date,
  type: keyof typeof ConnectType,
  status: string,
  shareID?: string,
  mute: boolean
}
export type Session = Record<string, Peer>;

export interface Peer {
  name: string,
  peerID: string,
  pc: RTCPeerConnection,
  remoteStream: MediaStream,
  listeners: Array<() => void>
  type: keyof typeof ConnectType
}

export enum ALERT_TYPE {
  success = 'success', 
  info = 'info', 
  warning = 'warning', 
  error = 'error', 
}

export enum CALL_TYPE {
  video = 'video',
  audio = 'audio'
}