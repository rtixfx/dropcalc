import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("firebase-applet-config.json", "utf-8"));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  try {
    await setDoc(doc(db, "test", "server-doc"), { value: 123 });
    console.log("Success Client SDK!");
  } catch (e: any) {
    console.error("Client error:", e.message);
  }
}
run();
