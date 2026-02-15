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
const btnDownload = document.getElementById('btn-download');

btnDownload.addEventListener('click', async () => {
    if (!fileInputL.files[0] || !fileInputR.files[0]) {
        statusText.innerText = "Please select both files to download a mix.";
        return;
    }

    statusText.innerText = "Preparing high-quality render...";

    // 1. Initialize temporary Context to get buffer lengths
    const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
    const [bufL, bufR] = await Promise.all([
        createSource(fileInputL.files[0]),
        createSource(fileInputR.files[0])
    ]);

    const duration = Math.max(bufL.duration, bufR.duration);
    const sampleRate = tempCtx.sampleRate;

    // 2. Create Offline Context for rendering
    const offlineCtx = new OfflineAudioContext(2, sampleRate * duration, sampleRate);

    // 3. Setup Panning for the Offline Render
    const offlineSrcL = offlineCtx.createBufferSource();
    const offlineSrcR = offlineCtx.createBufferSource();
    offlineSrcL.buffer = bufL;
    offlineSrcR.buffer = bufR;

    const offlinePannerL = new StereoPannerNode(offlineCtx, { pan: -1 });
    const offlinePannerR = new StereoPannerNode(offlineCtx, { pan: 1 });

    offlineSrcL.connect(offlinePannerL).connect(offlineCtx.destination);
    offlineSrcR.connect(offlinePannerR).connect(offlineCtx.destination);

    offlineSrcL.start(0);
    offlineSrcR.start(0);

    // 4. Render and Download
    const renderedBuffer = await offlineCtx.startRendering();
    const wavBlob = bufferToWav(renderedBuffer);
    
    const url = URL.createObjectURL(wavBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = "DualStereo_Mix_TNMY3010.wav";
    link.click();

    statusText.innerText = "Mix downloaded successfully!";
});

// Helper function to encode AudioBuffer to WAV format
function bufferToWav(abuffer) {
    let numOfChan = abuffer.numberOfChannels,
        length = abuffer.length * numOfChan * 2 + 44,
        buffer = new ArrayBuffer(length),
        view = new DataView(buffer),
        channels = [], i, sample,
        offset = 0,
        pos = 0;

    // Write WAV header
    setUint32(0x46464952);                         // "RIFF"
    setUint32(length - 8);                         // file length - 8
    setUint32(0x45564157);                         // "WAVE"
    setUint32(0x20746d66);                         // "fmt " chunk
    setUint32(16);                                 // length = 16
    setUint16(1);                                  // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(abuffer.sampleRate);
    setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2);                      // block-align
    setUint16(16);                                 // 16-bit
    setUint32(0x61746164);                         // "data" - chunk
    setUint32(length - pos - 4);                   // chunk length

    for(i = 0; i < abuffer.numberOfChannels; i++) channels.push(abuffer.getChannelData(i));

    while(pos < length) {
        for(i = 0; i < numOfChan; i++) {           // interleave channels
            sample = Math.max(-1, Math.min(1, channels[i][offset]));
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
            view.setInt16(pos, sample, true);      // write 16-bit sample
            pos += 2;
        }
        offset++;
    }

    return new Blob([buffer], {type: "audio/wav"});

    function setUint16(data) { view.setUint16(pos, data, true); pos += 2; }
    function setUint32(data) { view.setUint32(pos, data, true); pos += 4; }
}

// UI Feedback for file selection
fileInputL.addEventListener('change', () => statusText.innerText = "Left file loaded.");
fileInputR.addEventListener('change', () => statusText.innerText = "Right file loaded.");
