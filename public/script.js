const recognition = new (window.SpeechRecognition ||
  window.webkitSpeechRecognition)();
recognition.lang = "en-US";
recognition.interimResults = false;
recognition.maxAlternatives = 1;

recognition.onresult = function (event) {
  let transcript = event.results[0][0].transcript;
  console.log(transcript); // This can be removed later, it's just for debugging
  document.getElementById("transcribedText").textContent = transcript;
};

recognition.onerror = function (event) {
  console.error("Recognition error:", event.error);
};

let stream;
let mediaRecorder;
let audioChunks = [];

function initiateRecording(str) {
  mediaRecorder = new MediaRecorder(str);
  mediaRecorder.ondataavailable = (event) => {
    audioChunks.push(event.data);
  };

  mediaRecorder.onstop = async () => {
    const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
    audioChunks = [];
    const transcript = await sendToGCP(audioBlob);
    document.getElementById("transcribedText").textContent = transcript;
    str.getTracks().forEach((track) => track.stop());
  };

  mediaRecorder.start();
  document.getElementById("recordButton").textContent = "Stop Recording";
}

async function sendToGCP(blob) {
  const buffer = await blob.arrayBuffer();
  const audioBytes = Array.from(new Uint8Array(buffer))
    .map((byte) => {
      return ("0" + (byte & 0xff).toString(16)).slice(-2);
    })
    .join("");

  const audio = {
    content: audioBytes,
  };

  const request = {
    audio: audio,
    config: {
      encoding: "LINEAR16",
      sampleRateHertz: 16000,
      languageCode: "en-US",
      enableAutomaticPunctuation: true,
      enableSpeakerDiarization: true,
      minSpeakerCount: 1,
      maxSpeakerCount: 2,
      model: "phone_call",
    },
  };

  const response = await fetch("/transcribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  const data = await response.json();
  return data.transcript;
}

window.onload = function () {
  const prompts = [
    "Talk about your favorite childhood memory.",
    "Describe the last movie you watched.",
    "What's your dream vacation destination?",
    "How do you feel about pineapples on pizza?",
    "Who is your role model and why?",
    "What book have you read recently?",
    "Tell about a unique talent you have.",
  ];

  const randomIndex = Math.floor(Math.random() * prompts.length);
  const selectedPrompt = prompts[randomIndex];
  document.getElementById("randomPrompt").textContent = selectedPrompt;

  document
    .getElementById("recordButton")
    .addEventListener("click", function () {
      if (
        typeof mediaRecorder === "undefined" ||
        mediaRecorder.state === "inactive"
      ) {
        if (!stream) {
          navigator.mediaDevices
            .getUserMedia({ audio: true })
            .then((str) => {
              stream = str;
              initiateRecording(stream);
            })
            .catch((error) => {
              console.error("Error accessing the microphone.", error);
            });
        } else {
          initiateRecording(stream);
        }
      } else if (mediaRecorder.state === "recording") {
        mediaRecorder.stop();
        recognition.stop();
        this.textContent = "Start Recording";
      }
    });
};
