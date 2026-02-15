let audioContext;
let leftSource, rightSource;

async function loadAudio(file) {
  const arrayBuffer = await file.arrayBuffer();
  return await audioContext.decodeAudioData(arrayBuffer);
}

async function playAudio() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();

  const leftFile = document.getElementById("leftFile").files[0];
  const rightFile = document.getElementById("rightFile").files[0];

  if (!leftFile || !rightFile) {
    alert("Please upload both audio files.");
    return;
  }

  const leftBuffer = await loadAudio(leftFile);
  const rightBuffer = await loadAudio(rightFile);

  leftSource = audioContext.createBufferSource();
  rightSource = audioContext.createBufferSource();

  leftSource.buffer = leftBuffer;
  rightSource.buffer = rightBuffer;

  const leftGain = audioContext.createGain();
  const rightGain = audioContext.createGain();

  const leftPanner = audioContext.createStereoPanner();
  const rightPanner = audioContext.createStereoPanner();

  leftPanner.pan.value = -1;
  rightPanner.pan.value = 1;

  leftGain.gain.value = document.getElementById("leftVolume").value;
  rightGain.gain.value = document.getElementById("rightVolume").value;

  leftSource.connect(leftGain).connect(leftPanner).connect(audioContext.destination);
  rightSource.connect(rightGain).connect(rightPanner).connect(audioContext.destination);

  leftSource.start();
  rightSource.start();
}

function stopAudio() {
  if (leftSource) leftSource.stop();
  if (rightSource) rightSource.stop();
}
