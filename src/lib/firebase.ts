import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { firebaseConfig } from "./config";

// Guard: if tenant has not configured Firebase yet, do NOT silently
// connect to some default project. Throw a clear, loud error instead.
if (!firebaseConfig.projectId || !firebaseConfig.apiKey) {
  // eslint-disable-next-line no-console
  console.error(
    "[Firebase] Missing configuration. Set VITE_FIREBASE_* in .env " +
      "or fill src/lib/tenantConfig.ts before running the app.",
  );
  throw new Error(
    "Firebase is not configured for this tenant. " +
      "Set VITE_FIREBASE_* env vars or edit src/lib/tenantConfig.ts.",
  );
}

const app: FirebaseApp = initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export default app;

