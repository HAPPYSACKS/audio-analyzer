const express = require("express");
const bodyParser = require("body-parser");
const speech = require("@google-cloud/speech");
const path = require("path");

const app = express();
const port = 3000;

const client = new speech.SpeechClient({
  keyFilename:
    "/Users/ericmao/downloads/centered-oasis-402304-691ce216fc05.json",
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

app.use(bodyParser.json({ limit: "10mb" }));

app.post("/transcribe", async (req, res) => {
  const audio = req.body.audio;
  const config = req.body.config;

  try {
    const [response] = await client.recognize({
      audio: audio,
      config: config,
    });

    if (response && response.results && response.results.length > 0) {
        const transcriptWithSpeakers = response.results.map((result) => {
          if (result.alternatives && result.alternatives[0] && result.alternatives[0].words) {
            return result.alternatives[0].words.map(word => `Speaker ${word.speakerTag}: ${word.word}`).join(' ');
          }
          return result.alternatives[0].transcript;
        }).join("\n");
      
        res.json({ transcript: transcriptWithSpeakers });
      } else {
        res.json({ transcript: "" });
      }
      
  } catch (error) {
    console.error("Error processing speech:", error);
    res.status(500).send("Error processing speech.");
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
