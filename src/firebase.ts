import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GithubAuthProvider } from 'firebase/auth';

export const firebaseConfig = {
  apiKey: 'AIzaSyC9rNY8ooNVkqQx4e5VNO5DFxByg1sIjLg',
  authDomain: 'it-course-lele.firebaseapp.com',
  projectId: 'it-course-lele',
  storageBucket: 'it-course-lele.firebasestorage.app',
  messagingSenderId: '605493061801',
  appId: '1:605493061801:web:36caee46158b6ace8421b8',
};

export const ADMIN_UID = 'A4x3C68w2tSp65CplZgxEflCeVh1';

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const githubProvider = new GithubAuthProvider();
