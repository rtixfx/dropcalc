import admin from "firebase-admin";

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: "outstanding-inscriber-psjh2"
});

async function run() {
  try {
    const token = await admin.auth().createCustomToken("test-discord-id");
    console.log("Success! Token:", token);
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}
run();
