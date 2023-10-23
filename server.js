const express = require("express");
const bodyParser = require("body-parser");
const speech = require("@google-cloud/speech");
const path = require("path");
const fs = require("fs");
const exec = require("child_process").exec;
const axios = require("axios");
require("dotenv").config();

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const app = express();
const port = 3000;

const client = new speech.SpeechClient({
  keyFilename: process.env.GOOGLE_CLOUD_KEY,
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

app.use(bodyParser.json({ limit: "10mb" }));

function convertWebMToOgg(inputPath, outputPath, callback) {
  const command = `ffmpeg -y -i ${inputPath} -c:a libopus ${outputPath}`;
  console.log(`Executing command: ${command}`);
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return;
    }
    console.log(`stdout: ${stdout}`);
    console.log(`stderr: ${stderr}`);
    callback();
  });
}

async function getOpenAIResponse(topic, transcript) {
  console.log("OPENAI API Key:", process.env.OPENAI_API_KEY);

  try {
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "Determine if the given text discusses the topic of '" +
              topic +
              "'. Respond with only `yes` or `no`",
          },
          {
            role: "user",
            content: transcript,
          },
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    throw error;
  }
}

app.post("/transcribe", async (req, res) => {
  const audio = req.body.audio;
  const config = req.body.config;

  const base64String = audio.content;
  const buffer = Buffer.from(base64String, "base64");

  fs.writeFileSync("output_audio.webm", buffer);

  convertWebMToOgg("output_audio.webm", "output_audio.ogg", async () => {
    try {
      console.log("Conversion complete!");

      const content = fs.readFileSync("output_audio.ogg").toString("base64");

      const [response] = await client.recognize({
        audio: {
          content: content,
        },
        config: config,
      });

      if (response && response.results && response.results.length > 0) {
        const transcript = response.results
          .map((result) => result.alternatives[0].transcript)
          .join("\n");

        console.log(`Transcription: ${transcript}`);

        res.json({ transcript: transcript });
      } else {
        res.json({ transcript: "" });
      }
    } catch (error) {
      console.error("Error processing speech:", error.message, error);

      res.status(500).send("Error processing speech.");
    }
  });
});

app.post("/check-topic", async (req, res) => {
  const { transcript, topic } = req.body;

  try {
    const response = await getOpenAIResponse(topic, transcript);
    const chatGPTResponse = response.choices[0];

    res.json({ topicResponse: chatGPTResponse });
  } catch (error) {
    console.error("Error sending data to OpenAI:", error);
    res.status(500).send("Error querying OpenAI.");
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
