import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GithubAuthProvider } from 'firebase/auth';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyC9rNY8ooNVkqQx4e5VNO5DFxByg1sIjLg',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'it-course-lele.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'it-course-lele',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'it-course-lele.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '605493061801',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:605493061801:web:36caee46158b6ace8421b8',
};

export const ADMIN_UID = 'A4x3C68w2tSp65CplZgxEflCeVh1';

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const githubProvider = new GithubAuthProvider();
