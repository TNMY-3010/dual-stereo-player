let audioCtx;
let sourceL, sourceR;
let gainL, gainR;
let pannerL, pannerR;

const btnPlay = document.getElementById('btn-play');
const btnStop = document.getElementById('btn-stop');
const statusText = document.getElementById('status');

// Elements
const fileInputL = document.getElementById('audio-left');
const fileInputR = document.getElementById('audio-right');
const volSliderL = document.getElementById('vol-left');
const volSliderR = document.getElementById('vol-right');

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

async function createSource(file) {
    const arrayBuffer = await file.arrayBuffer();
    return await audioCtx.decodeAudioData(arrayBuffer);
}

btnPlay.addEventListener('click', async () => {
    if (!fileInputL.files[0] || !fileInputR.files[0]) {
        statusText.innerText = "Please select both audio files first.";
        return;
    }

    initAudio();
    if (audioCtx.state === 'suspended') await audioCtx.resume();

    // Stop existing playback if any
    stopAudio();

    try {
        statusText.innerText = "Loading buffers...";
        
        const [bufferL, bufferR] = await Promise.all([
            createSource(fileInputL.files[0]),
            createSource(fileInputR.files[0])
        ]);

        // Setup Nodes
        sourceL = audioCtx.createBufferSource();
        sourceR = audioCtx.createBufferSource();
        sourceL.buffer = bufferL;
        sourceR.buffer = bufferR;

        gainL = audioCtx.createGain();
        gainR = audioCtx.createGain();
        
        // Hard Panning: -1 is Left, 1 is Right
        pannerL = new StereoPannerNode(audioCtx, { pan: -1 });
        pannerR = new StereoPannerNode(audioCtx, { pan: 1 });

        // Set initial volume
        gainL.gain.value = volSliderL.value;
        gainR.gain.value = volSliderR.value;

        // Route: Source -> Gain -> Panner -> Destination
        sourceL.connect(gainL).connect(pannerL).connect(audioCtx.destination);
        sourceR.connect(gainR).connect(pannerR).connect(audioCtx.destination);

        // Start synchronized
        const startTime = audioCtx.currentTime + 0.1;
        sourceL.start(startTime);
        sourceR.start(startTime);

        statusText.innerText = "Playing... (Left: File 1 | Right: File 2)";
    } catch (err) {
        console.error(err);
        statusText.innerText = "Error loading audio.";
    }
});

btnStop.addEventListener('click', stopAudio);

function stopAudio() {
    if (sourceL) { sourceL.stop(); sourceL = null; }
    if (sourceR) { sourceR.stop(); sourceR = null; }
    statusText.innerText = "Playback stopped.";
}

// Real-time Volume Updates
volSliderL.addEventListener('input', (e) => {
    if (gainL) gainL.gain.value = e.target.value;
});

volSliderR.addEventListener('input', (e) => {
    if (gainR) gainR.gain.value = e.target.value;
});

// UI Feedback for file selection
fileInputL.addEventListener('change', () => statusText.innerText = "Left file loaded.");
fileInputR.addEventListener('change', () => statusText.innerText = "Right file loaded.");
