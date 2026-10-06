import assert from "node:assert/strict";
import { initializeApp as initializeAdminApp, deleteApp as deleteAdminApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, Timestamp, terminate } from "firebase/firestore";

const projectId = "demo-rsvp-ci";
const hosts = { FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099", FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199" };
assert.equal(process.env.GCLOUD_PROJECT, projectId, "This test requires the explicit demo project.");
for (const [key, host] of Object.entries(hosts)) assert.equal(process.env[key], host, `${key} must point to the local emulator.`);
for (const url of [
  `http://${hosts.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${projectId}/accounts`,
  `http://${hosts.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${projectId}/databases/(default)/documents`
]) {
  const response = await fetch(url, { method: "DELETE" });
  assert.equal(response.ok, true, "Emulator state reset must succeed before testing.");
}

const admin = initializeAdminApp({ projectId, storageBucket: `${projectId}.appspot.com` }, "ci-sdk-smoke");
const client = initializeApp({ projectId, apiKey: "ci-dummy-key", appId: "ci-dummy-app" }, "ci-sdk-smoke");
const auth = getAuth(client);
connectAuthEmulator(auth, `http://${hosts.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
const db = getFirestore(client);
connectFirestoreEmulator(db, "127.0.0.1", 8080);
const adminDb = getAdminFirestore(admin);
const file = getStorage(admin).bucket().file("ci/sdk-smoke.txt");

try {
  await getAdminAuth(admin).createUser({ uid: "ci-owner", email: "owner@rsvp.test", password: "ci-pass-123456" });
  await getAdminAuth(admin).createUser({ uid: "ci-other", email: "other@rsvp.test", password: "ci-pass-123456" });
  await assert.rejects(signInWithEmailAndPassword(auth, "owner@rsvp.test", "incorrect-password"),
    (error) => ["auth/invalid-credential", "auth/wrong-password"].includes(error.code));
  const signedIn = await signInWithEmailAndPassword(auth, "owner@rsvp.test", "ci-pass-123456");
  const decoded = await getAdminAuth(admin).verifyIdToken(await signedIn.user.getIdToken());
  assert.equal(decoded.uid, "ci-owner");

  const plan = { planId: "ci-plan", ownerUid: "ci-owner", name: "CI plan", yearMonth: "2026-10",
    passwordHash: null, publicToken: "ci-public-token", isActive: true,
    createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
  await setDoc(doc(db, "plans", "ci-plan"), plan);
  assert.equal((await adminDb.doc("plans/ci-plan").get()).data().name, "CI plan");
  await adminDb.doc("plans/ci-plan").update({ name: "Admin update" });
  assert.equal((await getDoc(doc(db, "plans", "ci-plan"))).data().name, "Admin update");
  await signOut(auth);
  await assert.rejects(getDoc(doc(db, "plans", "ci-plan")), (error) => error.code === "permission-denied");
  await signInWithEmailAndPassword(auth, "other@rsvp.test", "ci-pass-123456");
  await assert.rejects(getDoc(doc(db, "plans", "ci-plan")), (error) => error.code === "permission-denied");
  await assert.rejects(setDoc(doc(db, "plans", "ci-plan"), plan), (error) => error.code === "permission-denied");

  // Exercise the Storage/gaxios/uuid dependency chain after its scoped override.
  await file.delete({ ignoreNotFound: true });
  await file.save(Buffer.from("rsvp-ci-storage"), { resumable: false });
  const [download] = await file.download();
  assert.equal(download.toString(), "rsvp-ci-storage");
  console.log("PASS: Web/Admin Auth and Firestore, unauthenticated/cross-owner Rules denial, Admin Storage upload/download.");
} finally {
  await file.delete({ ignoreNotFound: true });
  await signOut(auth);
  await terminate(db);
  await adminDb.terminate();
  await deleteApp(client);
  await deleteAdminApp(admin);
}
