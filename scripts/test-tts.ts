import { writeFileSync } from "node:fs";
import { kokoroNativeTTS } from "../src/tts/tts-core.js";

async function run() {
  console.log("Generating Kokoro TTS audio...");
  const wavBytes = await kokoroNativeTTS({
    text: "This is a native test of Kokoro TTS running inside ErnOS. The process was completely seamless and serverless.",
    voice: "am_michael",
    speed: 1.2,
  });

  writeFileSync("kokoro-final.wav", wavBytes);
  console.log("Saved to kokoro-final.wav");
}

run().catch(console.error);
