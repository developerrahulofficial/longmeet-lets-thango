import firebase from 'firebase/app';
import 'firebase/firestore';
import 'firebase/analytics';

import { config } from '../shared';

if (!firebase.apps.length) {
  firebase.initializeApp(config.firebaseConfig);
}

const db = firebase.firestore();
const analytics = firebase.analytics();

export {
  db,
  analytics
};
