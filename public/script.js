let recognition = new (window.SpeechRecognition ||
  window.webkitSpeechRecognition)();
recognition.lang = "en-US";
recognition.interimResults = false;
recognition.maxAlternatives = 1;

recognition.onresult = function (event) {
  let transcript = event.results[0][0].transcript;
  console.log(transcript);
  document.getElementById("transcribedText").textContent = transcript;
};

recognition.onerror = function (event) {
  console.error("Recognition error:", event.error);
};

let stream;
let mediaRecorder;
let audioChunks = [];

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = function () {
      resolve(reader.result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

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
  a.download = "recorded_audio.webm";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);
}

function initiateRecording(str, selectedPrompt) {
  mediaRecorder = new MediaRecorder(str, {
    mimeType: "audio/mp4",
  });
  mediaRecorder.ondataavailable = (event) => {
    audioChunks.push(event.data);
  };
  mediaRecorder.onstop = async () => {
    document.getElementById("mic").style.display = "none"; // Hide the mic
    document.getElementById("processingSpinner").style.display = "block"; // Show the spinner

    const audioBlob = new Blob(audioChunks, { type: "audio/mp4" });
    audioChunks = [];

    try {
      const sampleRate = await getSampleRateFromBlob(audioBlob);
      console.log(`Sample rate: ${sampleRate} Hz`);
    } catch (error) {
      console.error("Failed to get sample rate:", error);
    }

    // downloadAudio(audioBlob);
    console.log("How many times does this run?");
    const transcript = await sendToGCP(audioBlob);

    console.log(`transcript: ${transcript}`);
    const topic = selectedPrompt; // replace with the topic you're looking for
    const topicResponse = await checkTopicWithServer(transcript, topic);
    console.log(`Topic Response: ${topicResponse}`);

    document.getElementById("mic").style.display = "block"; // Show the mic
    document.getElementById("processingSpinner").style.display = "none"; // Hide the spinner

    str.getTracks().forEach((track) => track.stop());
    stream = null;
  };

  mediaRecorder.start();
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
    stream = null;
  }
  document.getElementById("mic").classList.remove("bobbing");
}

async function sendToGCP(blob) {
  const buffer = await blob.arrayBuffer();
  console.log(`blob type: ${typeof buffer}`);
  const audioBytes = new Uint8Array(buffer);
  const base64String = await blobToBase64(blob);
  const audio = {
    content: base64String,
  };

  console.log("hi!");

  const request = {
    audio: audio,
    config: {
      encoding: "OGG_OPUS",
      sampleRateHertz: 48000,
      languageCode: "en-US",
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

async function checkTopicWithServer(transcript, topic) {
  const response = await fetch("/check-topic", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ transcript, topic }),
  });

  if (!response.ok) {
    throw new Error("Server response was not ok");
  }

  const data = await response.json();

  console.log(`gpt response ${data.topicResponse.message.content}`);

  if (data.topicResponse.message.content === "yes") {
    // Unlock the lock screen by changing the background to the home screen
    document.querySelector(".lock-screen").classList.add("unlocked");
    document.querySelector(".time").style.display = "none";
    document.querySelector(".date").style.display = "none";
    document.getElementById("randomPrompt").style.display = "none";
    document.getElementById("transcribedText").style.display = "none";
    document.getElementById("mic").style.display = "none";
    document.getElementById("processingSpinner").style.display = "none";
    document.getElementById("lockIcon").style.display = "none";
  } else if (data.topicResponse.message.content === "no") {
    // Assuming the lock icon has an id of 'lockIcon'
    document.getElementById("lockIcon").classList.add("shake-icon");

    // Optionally, remove the shake animation after it's done
    setTimeout(() => {
      document.getElementById("lockIcon").classList.remove("shake-icon");
    }, 800); // The timeout should match the animation duration, which in this case is 0.8s or 800ms
  }

  return data.topicResponse;
}

window.onload = function () {
  const prompts = [
    "Talk about your favorite childhood memory.",
    "Describe the last movie you watched.",
    "What's your dream vacation destination?",
    "How do you feel about pineapples on pizza?",
    "Who is your role model and why?",
    "What book have you read recently?",
    "Talk about a unique talent you have.",
  ];

  const randomIndex = Math.floor(Math.random() * prompts.length);
  const selectedPrompt = prompts[randomIndex];
  document.getElementById("randomPrompt").textContent = selectedPrompt;

  document.getElementById("mic").addEventListener("click", function () {
    if (
      typeof mediaRecorder === "undefined" ||
      mediaRecorder.state === "inactive"
    ) {
      if (!stream) {
        navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then((str) => {
            stream = str;
            initiateRecording(stream, selectedPrompt);
          })
          .catch((error) => {
            console.error("Error accessing the microphone.", error);
          });
      } else {
        initiateRecording(stream, selectedPrompt);
      }
    } else if (mediaRecorder.state === "recording") {
      stopRecording();
      this.textContent = "Start Recording";
    }
    document.getElementById("mic").classList.add("bobbing");
  });
};
