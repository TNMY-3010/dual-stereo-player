let audioCtx;
let sourceL, sourceR, gainL, gainR;

const elements = {
    fileL: document.getElementById('audio-left'),
    fileR: document.getElementById('audio-right'),
    nameL: document.getElementById('name-left'),
    nameR: document.getElementById('name-right'),
    volL: document.getElementById('vol-left'),
    volR: document.getElementById('vol-right'),
    status: document.getElementById('status'),
    btnPlay: document.getElementById('btn-play'),
    btnStop: document.getElementById('btn-stop'),
    btnDown: document.getElementById('btn-download')
};

// Display file names when selected
elements.fileL.onchange = e => elements.nameL.innerText = e.target.files[0].name;
elements.fileR.onchange = e => elements.nameR.innerText = e.target.files[0].name;

async function getBuffer(file, ctx) {
    const arrayBuffer = await file.arrayBuffer();
    return await ctx.decodeAudioData(arrayBuffer);
}

function stopAudio() {
    if (sourceL) { sourceL.stop(); sourceL = null; }
    if (sourceR) { sourceR.stop(); sourceR = null; }
    elements.status.innerText = "Playback stopped.";
}

elements.btnPlay.onclick = async () => {
    if (!elements.fileL.files[0] || !elements.fileR.files[0]) {
        elements.status.innerText = "Error: Select two files.";
        return;
    }

    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    
    stopAudio();
    elements.status.innerText = "Loading...";

    const [bufL, bufR] = await Promise.all([
        getBuffer(elements.fileL.files[0], audioCtx),
        getBuffer(elements.fileR.files[0], audioCtx)
    ]);

    sourceL = audioCtx.createBufferSource();
    sourceR = audioCtx.createBufferSource();
    sourceL.buffer = bufL;
    sourceR.buffer = bufR;

    gainL = audioCtx.createGain();
    gainR = audioCtx.createGain();
    gainL.gain.value = elements.volL.value;
    gainR.gain.value = elements.volR.value;

    const pannerL = new StereoPannerNode(audioCtx, { pan: -1 });
    const pannerR = new StereoPannerNode(audioCtx, { pan: 1 });

    sourceL.connect(gainL).connect(pannerL).connect(audioCtx.destination);
    sourceR.connect(gainR).connect(pannerR).connect(audioCtx.destination);

    const startAt = audioCtx.currentTime + 0.1;
    sourceL.start(startAt);
    sourceR.start(startAt);
    elements.status.innerText = "Playing DualStereo Mix...";
};

elements.btnStop.onclick = stopAudio;

// DOWNLOAD LOGIC
elements.btnDown.onclick = async () => {
    if (!elements.fileL.files[0] || !elements.fileR.files[0]) return;
    
    elements.status.innerText = "Rendering mix... Please wait.";
    
    const offlineCtx = new OfflineAudioContext(2, 44100 * 300, 44100); // Max 5 mins placeholder
    const [bufL, bufR] = await Promise.all([
        getBuffer(elements.fileL.files[0], offlineCtx),
        getBuffer(elements.fileR.files[0], offlineCtx)
    ]);

    // Real length calculation
    const duration = Math.max(bufL.duration, bufR.duration);
    const finalCtx = new OfflineAudioContext(2, 44100 * duration, 44100);

    const sL = finalCtx.createBufferSource();
    const sR = finalCtx.createBufferSource();
    sL.buffer = bufL; sR.buffer = bufR;

    const pL = new StereoPannerNode(finalCtx, { pan: -1 });
    const pR = new StereoPannerNode(finalCtx, { pan: 1 });

    sL.connect(pL).connect(finalCtx.destination);
    sR.connect(pR).connect(finalCtx.destination);
    
    sL.start(0); sR.start(0);

    const renderedBuffer = await finalCtx.startRendering();
    const blob = bufferToWav(renderedBuffer);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "DualStereo_Mix_TNMY.wav";
    a.click();
    elements.status.innerText = "Download complete!";
};

// WAV Encoder (same as before)
function bufferToWav(abuffer) {
    let numOfChan = abuffer.numberOfChannels,
        length = abuffer.length * numOfChan * 2 + 44,
        buffer = new ArrayBuffer(length),
        view = new DataView(buffer),
        channels = [], i, sample, offset = 0, pos = 0;

    const setU16 = (d) => { view.setUint16(pos, d, true); pos += 2; };
    const setU32 = (d) => { view.setUint32(pos, d, true); pos += 4; };

    setU32(0x46464952); setU32(length - 8); setU32(0x45564157);
    setU32(0x20746d66); setU32(16); setU16(1); setU16(numOfChan);
    setU32(abuffer.sampleRate); setU32(abuffer.sampleRate * 2 * numOfChan);
    setU16(numOfChan * 2); setU16(16); setU32(0x61746164); setU32(length - pos - 4);

    for(i = 0; i < numOfChan; i++) channels.push(abuffer.getChannelData(i));
    while(pos < length) {
        for(i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][offset]));
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
            view.setInt16(pos, sample, true); pos += 2;
        }
        offset++;
    }
    return new Blob([buffer], {type: "audio/wav"});
}

// Volume Listeners
elements.volL.oninput = e => { if(gainL) gainL.gain.value = e.target.value; };
elements.volR.oninput = e => { if(gainR) gainR.gain.value = e.target.value; };
