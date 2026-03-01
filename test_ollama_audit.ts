import { fetch, Agent } from "undici";

const prompt = `Please output the word "ALLOWED".`;

const requestBody = JSON.stringify({
  model: "qwen3.5:35b",
  messages: [{ role: "user", content: prompt }],
  stream: true,
  options: {
    temperature: 0.1,
    num_predict: 256,
  },
  keep_alive: -1,
});

async function run() {
  console.log("Starting test at", new Date().toISOString());
  try {
    const res = await fetch(`http://127.0.0.1:11434/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: requestBody,
      dispatcher: new Agent({
        headersTimeout: 15 * 60 * 1000,
        bodyTimeout: 15 * 60 * 1000,
      }),
    });

    console.log("Response status:", res.status);
    for await (const chunk of res.body!) {
      console.log("CHUNK:", new TextDecoder().decode(chunk));
    }
  } catch (err) {
    console.error("Fetch failed:", err);
  }
  console.log("Finished test at", new Date().toISOString());
}

run();
