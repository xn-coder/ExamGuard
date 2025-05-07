// Import the functions you need from the SDKs you need
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, browserLocalPersistence, indexedDBLocalPersistence, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let firebaseApp: FirebaseApp;

try {
  if (!getApps().length) {
    firebaseApp = initializeApp(firebaseConfig);
  } else {
    firebaseApp = getApps()[0];
  }
} catch (error) {
  console.error("Firebase initialization error:", error);
  throw new Error("Failed to initialize Firebase. Check your configuration.");
}

// Initialize Firebase Auth and Firestore
// It's important to use initializeAuth for persistence options in newer SDKs
// and getAuth(firebaseApp) if you don't need special persistence.
// For this example, let's use getAuth directly for simplicity if advanced persistence isn't immediately needed,
// or initializeAuth if it is. Given the project's nature, local persistence is good.
let auth;
if (typeof window !== 'undefined') {
  // Use initializeAuth for robust persistence, especially for SSR/SSG frameworks like Next.js
  try {
    auth = initializeAuth(firebaseApp, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence]
    });
  } catch (e) {
    // Fallback for environments where initializeAuth might not be suitable or if there's an error
    // This could happen in some testing environments or if indexedDB is unavailable.
    console.error("Firebase initializeAuth failed, falling back to getAuth:", e);
    auth = getAuth(firebaseApp);
  }
} else {
  // For server-side rendering or Node.js environments, getAuth is standard.
  auth = getAuth(firebaseApp);
}


const db = getFirestore(firebaseApp);

export { firebaseApp, auth, db };
