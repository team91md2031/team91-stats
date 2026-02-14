import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAAUYhhGLvbEm02qVMU5OMe31HEAs5slbw",
  authDomain: "md-2031-stats.firebaseapp.com",
  projectId: "md-2031-stats",
  storageBucket: "md-2031-stats.firebasestorage.app",
  messagingSenderId: "833122569308",
  appId: "1:833122569308:web:56cb07a471fb050c152a99"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export const sSet = async (k, v) => {
  try {
    await setDoc(doc(db, 'kv', k), { key: k, value: JSON.stringify(v), ts: Date.now() });
    return true;
  } catch (e) { console.error('sSet:', e); return null; }
};

export const sGet = async (k) => {
  try {
    const snap = await getDoc(doc(db, 'kv', k));
    return snap.exists() ? JSON.parse(snap.data().value) : null;
  } catch (e) { console.error('sGet:', e); return null; }
};

export const sList = async (prefix) => {
  try {
    const q = query(collection(db, 'kv'), where('key', '>=', prefix), where('key', '<=', prefix + '\uf8ff'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data().key);
  } catch (e) { console.error('sList:', e); return []; }
};
Click "Commit changes". Let me know when done and I'll give you the big one — App.jsx.
