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

async function getSampleRateFromBlob(audioBlob) {
  return new Promise(async (resolve, reject) => {
    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    const arrayBuffer = await audioBlob.arrayBuffer();
    audioContext.decodeAudioData(
      arrayBuffer,
      function (buffer) {
        resolve(buffer.sampleRate);
      },
      function (error) {
        reject(new Error("Error decoding audio data: " + error.err));
      }
    );
  });
}

function downloadAudio(blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = "recorded_audio.webm"; // You can change the name here
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);
}

function initiateRecording(str) {
  mediaRecorder = new MediaRecorder(str);
  mediaRecorder.ondataavailable = (event) => {
    audioChunks.push(event.data);
  };
  mediaRecorder.onstop = async () => {
    const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
    audioChunks = [];

    // Extract and log the sample rate
    try {
      const sampleRate = await getSampleRateFromBlob(audioBlob);
      console.log(`Sample rate: ${sampleRate} Hz`);
    } catch (error) {
      console.error("Failed to get sample rate:", error);
    }

    downloadAudio(audioBlob);
    const transcript = await sendToGCP(audioBlob);
    document.getElementById("transcribedText").textContent = transcript;
    console.log(`transcript: ${transcript}`);
    str.getTracks().forEach((track) => track.stop());
  };

  mediaRecorder.start();
  document.getElementById("recordButton").textContent = "Stop Recording";
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  }

  if (recognition && recognition.state === "recording") {
    recognition.stop();
  }

  if (stream) {
    let tracks = stream.getTracks();
    tracks.forEach((track) => track.stop());
    stream = null; // Clear the stream variable
  }
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
      encoding: "OGG_OPUS",
      sampleRateHertz: 48000,
      languageCode: "en-US",
      enableAutomaticPunctuation: true,
      enableSpeakerDiarization: true,
      minSpeakerCount: 1,
      maxSpeakerCount: 2,
      model: "default",
    },
  };

  const response = await fetch("/transcribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error("Network response was not ok");
  }

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
        stopRecording();
        this.textContent = "Start Recording";
      }
    });
};
