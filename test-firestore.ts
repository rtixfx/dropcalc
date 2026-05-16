import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

admin.initializeApp();
const db = getFirestore(admin.app(), "ai-studio-1b7c9ab5-2aa9-4ca2-954a-6f1dccc91e0c");

async function run() {
  try {
    await db.collection("users").limit(1).get();
    console.log("Success!");
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}
run();
