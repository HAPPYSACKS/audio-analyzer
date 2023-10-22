const fs = require("fs");

// Imports the Google Cloud client library
const speech = require("@google-cloud/speech").v1p1beta1;

// Creates a client
const client = new speech.SpeechClient({
  keyFilename:
    "/Users/ericmao/downloads/centered-oasis-402304-691ce216fc05.json",
});

const fileName = "./output_audio.ogg";

const config = {
  encoding: "OGG_OPUS",
  sampleRateHertz: 48000,
  languageCode: "en-US",
  enableSpeakerDiarization: true,
  minSpeakerCount: 1,
  maxSpeakerCount: 2,
  model: "default",
};

const audio = {
  content: fs.readFileSync(fileName).toString("base64"),
};

const request = {
  config: config,
  audio: audio,
};

async function transcribe() {
  const [response] = await client.recognize(request);
  const transcription = response.results
    .map((result) => result.alternatives[0].transcript)
    .join("\n");
  console.log(`Transcription: ${transcription}`);
  console.log("Speaker Diarization:");
  const result = response.results[response.results.length - 1];
  const wordsInfo = result.alternatives[0].words;
  // Note: The transcript within each result is separate and sequential per result.
  // However, the words list within an alternative includes all the words
  // from all the results thus far. Thus, to get all the words with speaker
  // tags, you only have to take the words list from the last result:
  wordsInfo.forEach((a) =>
    console.log(` word: ${a.word}, speakerTag: ${a.speakerTag}`)
  );
}

// Call the function to start the transcription process
transcribe();
