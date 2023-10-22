const express = require("express");
const bodyParser = require("body-parser");
const speech = require("@google-cloud/speech");
const path = require("path");
const fs = require("fs");
const exec = require("child_process").exec;

const app = express();
const port = 3000;

const client = new speech.SpeechClient({
  keyFilename:
    "/Users/ericmao/downloads/centered-oasis-402304-691ce216fc05.json",
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

app.post("/transcribe", async (req, res) => {
  const audio = req.body.audio;
  const config = req.body.config;

  const base64String = audio.content; // Your base64 string here
  const buffer = Buffer.from(base64String, "base64");

  fs.writeFileSync("output_audio.webm", buffer);

  convertWebMToOgg("output_audio.webm", "output_audio.ogg", async () => {
    try {
      console.log("conversion complete!");
      const [response] = await client.recognize({
        audio: {
          content: fs.readFileSync("output_audio.ogg").toString("base64"),
        },
        config: config,
      });
      if (response && response.results && response.results.length > 0) {
        const transcriptWithSpeakers = response.results
          .map((result) => {
            if (
              result.alternatives &&
              result.alternatives[0] &&
              result.alternatives[0].words
            ) {
              return result.alternatives[0].words
                .map((word) => `Speaker ${word.speakerTag}: ${word.word}`)
                .join(" ");
            }
            return result.alternatives[0].transcript;
          })
          .join("\n");

        res.json({ transcript: transcriptWithSpeakers });
      } else {
        res.json({ transcript: "" });
      }
    } catch (error) {
      console.error("Error processing speech:", error.message, error);

      res.status(500).send("Error processing speech.");
    }
  });
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
