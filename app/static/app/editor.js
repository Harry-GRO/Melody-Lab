document.addEventListener('DOMContentLoaded', function () {
    // WEB AUDIO API ELEMENTS
    let AudioContext;
    let audioContext;
    let track;
    let pannerOptions;
    let panner;
    let gainNode;
    // EQ NODES
    let bassFilter, midFilter, trebleFilter;

    // EFFECTS NODES
    let reverbNode, reverbWetGain, reverbDryGain;
    let delayNode, delayFeedbackGain, delayWetGain, delayDryGain;
    let distortionNode, distortionWetGain, distortionDryGain;

    const audioElement = document.getElementById('audioPlayer');
    let isContextInitialized = false;
    let currentlyDownloading = false;

    // WAVEFORM ELEMENTS
    const waveformCanvas = document.getElementById('waveformCanvas');
    const waveformCtx = waveformCanvas.getContext('2d');
    const waveformWrapper = document.getElementById('waveformWrapper');
    const waveformLoadingText = document.getElementById('waveformLoadingText');
    let waveformData = null;
    let animationFrameId = null;

    // ─────────────────────────────────────────
    // TRIM STATE
    // ─────────────────────────────────────────
    let trimStart = 0;
    let trimEnd = 1;
    let dragging = null;
    const HANDLE_HIT = 10;

    const resetTrimButton = document.getElementById('resetTrimButton');

    // GET FILENAME ELEMENTS
    const dataSend = document.getElementById('dataSend');
    const fileName = dataSend.getAttribute('fileName');
    var dotIndex = fileName.lastIndexOf('.');
    const fileNameWithoutExtension = fileName.substring(0, dotIndex);

    // INPUT ELEMENTS
    const homeRedirectButton = document.getElementById('homeRedirectButton');
    const playButton = document.getElementById('playPauseButton');
    const differentFileButton = document.getElementById('differentFileButton');
    const downloadButton = document.getElementById('downloadButton');
    downloadButton.disabled = true;
    const autoPanCheckbox = document.getElementById('autoPanCheckbox');
    autoPanCheckbox.checked = false;

    // SLIDER ELEMENTS
    let slidersInitialized = false;
    const inputEvent = new Event('input');
    const volumeSlider = document.getElementById('volumeSlider');
    const volumeSliderValue = document.getElementById('volumeValue');
    const speedSliderValue = document.getElementById('speedValue');
    const panSliderValue = document.getElementById('panValue');
    const speedSlider = document.getElementById('speedSlider');
    const panSlider = document.getElementById('panSlider');

    // EQ SLIDER ELEMENTS
    const bassSlider = document.getElementById('bassSlider');
    const midSlider = document.getElementById('midSlider');
    const trebleSlider = document.getElementById('trebleSlider');
    const bassValue = document.getElementById('bassValue');
    const midValue = document.getElementById('midValue');
    const trebleValue = document.getElementById('trebleValue');

    // EFFECTS ELEMENTS
    const reverbToggle = document.getElementById('reverbToggle');
    const reverbMixSlider = document.getElementById('reverbMixSlider');
    const reverbDecaySlider = document.getElementById('reverbDecaySlider');
    const reverbMixValue = document.getElementById('reverbMixValue');
    const reverbDecayValue = document.getElementById('reverbDecayValue');
    const delayToggle = document.getElementById('delayToggle');
    const delayTimeSlider = document.getElementById('delayTimeSlider');
    const delayFeedbackSlider = document.getElementById('delayFeedbackSlider');
    const delayTimeValue = document.getElementById('delayTimeValue');
    const delayFeedbackValue = document.getElementById('delayFeedbackValue');
    const distortionToggle = document.getElementById('distortionToggle');
    const distortionAmountSlider = document.getElementById('distortionAmountSlider');
    const distortionAmountValue = document.getElementById('distortionAmountValue');


    // TEXT ELEMENTS
    const panWarningText = document.getElementById('panWarningText');
    downloadingConfirmationText = document.getElementById('downloadingConfirmationText');
    downloadingConfirmationText.style.display = 'none';

    // ─────────────────────────────────────────
    // WAVEFORM: DECODE AUDIO AND BUILD DATA
    // ─────────────────────────────────────────
    async function loadWaveform() {
        try {
            const response = await fetch(audioElement.src);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            const rawData = audioBuffer.getChannelData(0);
            const samples = waveformCanvas.width;
            const blockSize = Math.floor(rawData.length / samples);
            const dataPoints = [];

            for (let i = 0; i < samples; i++) {
                let sum = 0;
                for (let j = 0; j < blockSize; j++) {
                    sum += Math.abs(rawData[i * blockSize + j]);
                }
                dataPoints.push(sum / blockSize);
            }

            const max = Math.max(...dataPoints);
            waveformData = dataPoints.map(v => v / max);

            waveformLoadingText.style.display = 'none';
            drawWaveform(0);
        } catch (e) {
            console.error('Waveform load failed:', e);
        }
    }

    // ─────────────────────────────────────────
    // WAVEFORM: DRAW WITH TRIM REGION + PLAYHEAD
    // ─────────────────────────────────────────
    function drawWaveform(progress) {
        if (!waveformData) return;

        const W = waveformCanvas.width;
        const H = waveformCanvas.height;
        const mid = H / 2;
        const playedX = progress * W;
        const startX = trimStart * W;
        const endX = trimEnd * W;

        waveformCtx.clearRect(0, 0, W, H);

        waveformCtx.fillStyle = 'rgba(0,0,0,0.45)';
        waveformCtx.fillRect(0, 0, startX, H);
        waveformCtx.fillRect(endX, 0, W - endX, H);

        waveformCtx.fillStyle = 'rgba(181,136,108,0.12)';
        waveformCtx.fillRect(startX, 0, endX - startX, H);

        for (let i = 0; i < waveformData.length; i++) {
            const x = i;
            const amplitude = waveformData[i] * mid * 0.9;
            const inTrim = x >= startX && x <= endX;
            const played = x < playedX;

            if (!inTrim) {
                waveformCtx.fillStyle = 'rgba(245,245,245,0.12)';
            } else if (played) {
                waveformCtx.fillStyle = '#f5f5f5';
            } else {
                waveformCtx.fillStyle = 'rgba(245,245,245,0.4)';
            }

            waveformCtx.fillRect(x, mid - amplitude, 1, amplitude * 2);
        }

        waveformCtx.fillStyle = '#b5886c';
        waveformCtx.fillRect(startX - 1, 0, 2, H);
        waveformCtx.fillRect(endX - 1, 0, 2, H);

        waveformCtx.fillStyle = '#b5886c';
        waveformCtx.beginPath();
        waveformCtx.roundRect(startX - 5, 0, 10, 18, 3);
        waveformCtx.fill();
        waveformCtx.beginPath();
        waveformCtx.roundRect(endX - 5, 0, 10, 18, 3);
        waveformCtx.fill();

        waveformCtx.fillStyle = '#ffffff';
        waveformCtx.fillRect(playedX - 1, 0, 2, H);
    }

    // ─────────────────────────────────────────
    // WAVEFORM: ANIMATION LOOP
    // ─────────────────────────────────────────
    function startWaveformAnimation() {
        function frame() {
            const progress = audioElement.currentTime / audioElement.duration || 0;

            if (audioElement.duration) {
                const trimStartTime = trimStart * audioElement.duration;
                const trimEndTime = trimEnd * audioElement.duration;
                if (audioElement.currentTime < trimStartTime) {
                    audioElement.currentTime = trimStartTime;
                }
                if (audioElement.currentTime >= trimEndTime) {
                    audioElement.currentTime = trimStartTime;
                }
            }

            drawWaveform(progress);
            animationFrameId = requestAnimationFrame(frame);
        }
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = requestAnimationFrame(frame);
    }

    // ─────────────────────────────────────────
    // TRIM: DRAG HANDLES
    // ─────────────────────────────────────────
    function getMouseX(e) {
        const rect = waveformCanvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        return clientX - rect.left;
    }

    function hitTest(mouseX) {
        const W = waveformCanvas.width;
        const startX = trimStart * W;
        const endX = trimEnd * W;
        if (Math.abs(mouseX - startX) <= HANDLE_HIT) return 'start';
        if (Math.abs(mouseX - endX) <= HANDLE_HIT) return 'end';
        return null;
    }

    waveformCanvas.addEventListener('mousedown', function (e) {
        const x = getMouseX(e);
        const hit = hitTest(x);
        if (hit) {
            dragging = hit;
            waveformCanvas.style.cursor = 'ew-resize';
        }
    });

    window.addEventListener('mousemove', function (e) {
        if (!dragging) {
            const x = getMouseX(e);
            waveformCanvas.style.cursor = hitTest(x) ? 'ew-resize' : 'pointer';
            return;
        }
        const W = waveformCanvas.width;
        const x = getMouseX(e);
        const fraction = Math.max(0, Math.min(1, x / W));

        if (dragging === 'start') {
            trimStart = Math.min(fraction, trimEnd - 0.01);
        } else if (dragging === 'end') {
            trimEnd = Math.max(fraction, trimStart + 0.01);
        }
    });

    window.addEventListener('mouseup', function () {
        if (dragging) {
            dragging = null;
            waveformCanvas.style.cursor = 'pointer';
            if (audioElement.duration) {
                const trimStartTime = trimStart * audioElement.duration;
                const trimEndTime = trimEnd * audioElement.duration;
                if (audioElement.currentTime < trimStartTime || audioElement.currentTime > trimEndTime) {
                    audioElement.currentTime = trimStartTime;
                }
            }
        }
    });

    waveformCanvas.addEventListener('click', function (e) {
        if (hitTest(getMouseX(e))) return;
        const rect = waveformCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percent = Math.max(trimStart, Math.min(trimEnd, x / waveformCanvas.width));
        audioElement.currentTime = percent * audioElement.duration;
    });

    resetTrimButton.addEventListener('click', function () {
        trimStart = 0;
        trimEnd = 1;
        if (audioElement.duration) audioElement.currentTime = 0;
    });

    // ─────────────────────────────────────────
    // WAVEFORM: SIZE CANVAS TO WRAPPER
    // ─────────────────────────────────────────
    function resizeCanvas() {
        waveformCanvas.width = waveformWrapper.clientWidth;
        waveformCanvas.height = waveformWrapper.clientHeight;
        if (waveformData) {
            const progress = audioElement.currentTime / audioElement.duration || 0;
            drawWaveform(progress);
        }
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // RESET SLIDERS WHEN PLAY FIRST PRESSED
    function initializeSliders() {
        speedSlider.value = 1;
        panSlider.value = 0;
        volumeSlider.value = 100;
        updateSliderTextValues();
    }

    // SYNC SLIDERS TO AUDIO ELEMENT
    function syncSlidersToAudioElement() {
        speedSlider.value = audioElement.playbackRate;
        panSlider.value = panner.pan.value;
        volumeSlider.value = gainNode.gain.value * 100;
        updateSliderTextValues();
    }

    // UPDATES SLIDER TEXT VALUES TO THE CURRENT SLIDER POSITION
    function updateSliderTextValues() {
        speedSliderValue.textContent = speedSlider.value;
        panSliderValue.textContent = panSlider.value;
        volumeSliderValue.textContent = volumeSlider.value;
    }

    // ─────────────────────────────────────────
    // EFFECTS HELPERS
    // ─────────────────────────────────────────
    function buildImpulseResponse(ctx, duration, decay) {
        const length = ctx.sampleRate * duration;
        const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const data = impulse.getChannelData(ch);
            for (let i = 0; i < length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
            }
        }
        return impulse;
    }

    function buildDistortionCurve(amount) {
        const samples = 256;
        const curve = new Float32Array(samples);
        const deg = Math.PI / 180;
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
        }
        return curve;
    }

    // ─────────────────────────────────────────
    // WEB AUDIO API START
    // Chain: track → gain → EQ → reverb → delay → distortion → panner → destination
    // ─────────────────────────────────────────
    function initializeContext() {
        AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContext();

        track = audioContext.createMediaElementSource(audioElement);

        audioElement.preservesPitch = false;
        audioElement.webkitPreservesPitch = false;
        audioElement.loop = true;

        pannerOptions = { pan: 0 };
        panner = new StereoPannerNode(audioContext, pannerOptions);

        gainNode = audioContext.createGain();

        // EQ FILTERS
        bassFilter = audioContext.createBiquadFilter();
        bassFilter.type = 'lowshelf'; bassFilter.frequency.value = 200; bassFilter.gain.value = 0;
        midFilter = audioContext.createBiquadFilter();
        midFilter.type = 'peaking'; midFilter.frequency.value = 1000; midFilter.Q.value = 1; midFilter.gain.value = 0;
        trebleFilter = audioContext.createBiquadFilter();
        trebleFilter.type = 'highshelf'; trebleFilter.frequency.value = 4000; trebleFilter.gain.value = 0;

        // REVERB (parallel dry/wet)
        reverbNode = audioContext.createConvolver();
        reverbNode.buffer = buildImpulseResponse(audioContext, parseFloat(reverbDecaySlider.value), 2);
        reverbWetGain = audioContext.createGain(); reverbWetGain.gain.value = 0;
        reverbDryGain = audioContext.createGain(); reverbDryGain.gain.value = 1;
        const reverbMix = audioContext.createGain();

        // DELAY (parallel dry/wet)
        delayNode = audioContext.createDelay(5.0);
        delayNode.delayTime.value = parseFloat(delayTimeSlider.value);
        delayFeedbackGain = audioContext.createGain(); delayFeedbackGain.gain.value = parseFloat(delayFeedbackSlider.value);
        delayWetGain = audioContext.createGain(); delayWetGain.gain.value = 0;
        delayDryGain = audioContext.createGain(); delayDryGain.gain.value = 1;
        const delayMix = audioContext.createGain();

        // DISTORTION (parallel dry/wet)
        distortionNode = audioContext.createWaveShaper();
        distortionNode.curve = buildDistortionCurve(parseFloat(distortionAmountSlider.value));
        distortionNode.oversample = '4x';
        distortionWetGain = audioContext.createGain(); distortionWetGain.gain.value = 0;
        distortionDryGain = audioContext.createGain(); distortionDryGain.gain.value = 1;
        const distortionMix = audioContext.createGain();

        // Wire the full chain
        track.connect(gainNode).connect(bassFilter).connect(midFilter).connect(trebleFilter);

        trebleFilter.connect(reverbDryGain).connect(reverbMix);
        trebleFilter.connect(reverbNode).connect(reverbWetGain).connect(reverbMix);

        reverbMix.connect(delayDryGain).connect(delayMix);
        reverbMix.connect(delayNode).connect(delayWetGain).connect(delayMix);
        delayNode.connect(delayFeedbackGain).connect(delayNode);

        delayMix.connect(distortionDryGain).connect(distortionMix);
        delayMix.connect(distortionNode).connect(distortionWetGain).connect(distortionMix);

        distortionMix.connect(panner).connect(audioContext.destination);

        loadWaveform();
        startWaveformAnimation();
    }

    // ─────────────────────────────────────────
    // EQ: SLIDER LISTENERS
    // ─────────────────────────────────────────
    bassSlider.addEventListener('input', function () {
        bassValue.textContent = (bassSlider.value > 0 ? '+' : '') + bassSlider.value + 'dB';
        if (bassFilter) bassFilter.gain.value = parseFloat(bassSlider.value);
    });

    midSlider.addEventListener('input', function () {
        midValue.textContent = (midSlider.value > 0 ? '+' : '') + midSlider.value + 'dB';
        if (midFilter) midFilter.gain.value = parseFloat(midSlider.value);
    });

    trebleSlider.addEventListener('input', function () {
        trebleValue.textContent = (trebleSlider.value > 0 ? '+' : '') + trebleSlider.value + 'dB';
        if (trebleFilter) trebleFilter.gain.value = parseFloat(trebleSlider.value);
    });

    // ─────────────────────────────────────────
    // EFFECTS: LISTENERS
    // ─────────────────────────────────────────
    reverbToggle.addEventListener('change', () => {
        if (!reverbWetGain) return;
        const mix = reverbToggle.checked ? parseFloat(reverbMixSlider.value) / 100 : 0;
        reverbWetGain.gain.value = mix;
        reverbDryGain.gain.value = 1 - mix;
    });

    reverbMixSlider.addEventListener('input', () => {
        reverbMixValue.textContent = reverbMixSlider.value + '%';
        if (!reverbWetGain || !reverbToggle.checked) return;
        const mix = parseFloat(reverbMixSlider.value) / 100;
        reverbWetGain.gain.value = mix;
        reverbDryGain.gain.value = 1 - mix;
    });

    reverbDecaySlider.addEventListener('input', () => {
        reverbDecayValue.textContent = reverbDecaySlider.value + 's';
        if (reverbNode) reverbNode.buffer = buildImpulseResponse(audioContext, parseFloat(reverbDecaySlider.value), 2);
    });

    delayToggle.addEventListener('change', () => {
        if (!delayWetGain) return;
        delayWetGain.gain.value = delayToggle.checked ? 0.5 : 0;
        delayDryGain.gain.value = 1;
    });

    delayTimeSlider.addEventListener('input', () => {
        delayTimeValue.textContent = delayTimeSlider.value + 's';
        if (delayNode) delayNode.delayTime.value = parseFloat(delayTimeSlider.value);
    });

    delayFeedbackSlider.addEventListener('input', () => {
        delayFeedbackValue.textContent = Math.round(delayFeedbackSlider.value * 100) + '%';
        if (delayFeedbackGain) delayFeedbackGain.gain.value = parseFloat(delayFeedbackSlider.value);
    });

    distortionToggle.addEventListener('change', () => {
        if (!distortionWetGain) return;
        distortionWetGain.gain.value = distortionToggle.checked ? 1 : 0;
        distortionDryGain.gain.value = distortionToggle.checked ? 0 : 1;
    });

    distortionAmountSlider.addEventListener('input', () => {
        distortionAmountValue.textContent = distortionAmountSlider.value;
        if (distortionNode) distortionNode.curve = buildDistortionCurve(parseFloat(distortionAmountSlider.value));
    });


    // ─────────────────────────────────────────
    // PLAY/PAUSE TOGGLE (shared logic used by button + keyboard)
    // ─────────────────────────────────────────
    function togglePlayPause() {
        if (!isContextInitialized) {
            initializeContext();
            isContextInitialized = true;
        }

        if (!currentlyDownloading) downloadButton.disabled = false;

        if (!slidersInitialized) {
            initializeSliders();
            slidersInitialized = true;
        }

        if (audioContext.state === "suspended") {
            audioContext.resume();
            syncSlidersToAudioElement();
        }

        if (playButton.textContent === "Play") {
        if (audioElement.duration && audioElement.currentTime === 0) {
            audioElement.currentTime = trimStart * audioElement.duration;
        }
        audioElement.play();
        playButton.textContent = "Pause";
        } else {
            audioElement.pause();
            playButton.textContent = "Play";
        }
    }

    // PLAY BUTTON CLICK
    playButton.addEventListener("click", togglePlayPause, false);

    // ─────────────────────────────────────────
    // KEYBOARD SHORTCUTS
    // ─────────────────────────────────────────
    document.addEventListener('keydown', function (e) {
        // Ignore if user is typing in an input
        if (e.target.tagName === 'INPUT') return;

        switch (e.key) {
            case ' ':
                e.preventDefault();
                togglePlayPause();
                break;

            case 'ArrowRight':
                e.preventDefault();
                if (audioElement.duration) {
                    const newTime = Math.min(audioElement.currentTime + 5, trimEnd * audioElement.duration);
                    audioElement.currentTime = newTime;
                }
                break;

            case 'ArrowLeft':
                e.preventDefault();
                if (audioElement.duration) {
                    const newTime = Math.max(audioElement.currentTime - 5, trimStart * audioElement.duration);
                    audioElement.currentTime = newTime;
                }
                break;

            case 'm':
            case 'M':
                if (gainNode) {
                    const isMuted = gainNode.gain.value === 0;
                    gainNode.gain.value = isMuted ? parseFloat(volumeSlider.value) / 100 : 0;
                    volumeSlider.style.opacity = isMuted ? '0.9' : '0.3';
                }
                break;

            case 'r':
            case 'R':
                trimStart = 0;
                trimEnd = 1;
                if (audioElement.duration) audioElement.currentTime = 0;
                break;

            case 'ArrowUp':
                e.preventDefault();
                volumeSlider.value = Math.min(150, parseFloat(volumeSlider.value) + 5);
                volumeSlider.dispatchEvent(new Event('input'));
                break;

            case 'ArrowDown':
                e.preventDefault();
                volumeSlider.value = Math.max(0, parseFloat(volumeSlider.value) - 5);
                volumeSlider.dispatchEvent(new Event('input'));
                break;
        }
    });

    // DETECT SPEED SLIDER CHANGE
    speedSlider.addEventListener('input', function () {
        updateSliderTextValues();
        audioElement.playbackRate = parseFloat(speedSlider.value).toFixed(2);
    });

    // DETECT PAN SLIDER CHANGE
    panSlider.addEventListener('input', function () {
        updateSliderTextValues();
        panner.pan.value = parseFloat(panSlider.value).toFixed(2);
    });

    // AUTO PAN FUNCTIONALITY
    autoPanCheckbox.addEventListener('change', function () {
        if (this.checked) {
            panSliderValue.style.display = 'none';
            panSlider.step = 0.01;
            let currentPanValue = 0;
            let increment = 0.01;
            autoPanInterval = setInterval(() => {
                currentPanValue += increment;
                if (currentPanValue >= 1 || currentPanValue <= -1) {
                    increment *= -1;
                    currentPanValue = currentPanValue >= 1 ? 1 : -1;
                }
                panSlider.value = currentPanValue.toFixed(2);
                panSlider.dispatchEvent(inputEvent);
                if (!autoPanCheckbox.checked) clearInterval(autoPanInterval);
            }, 10);
        } else {
            panSliderValue.style.display = 'flex';
            panSlider.step = 0.1;
            clearInterval(autoPanInterval);
            panSlider.value = 0;
            panSlider.dispatchEvent(inputEvent);
        }
    });

    // DETECT VOLUME SLIDER CHANGE
    volumeSlider.addEventListener('input', function () {
        updateSliderTextValues();
        gainNode.gain.value = parseFloat(volumeSlider.value).toFixed(2) / 100;
    });

    // ─────────────────────────────────────────
    // EXPORT: RESPECTS TRIM REGION
    // ─────────────────────────────────────────
    downloadButton.addEventListener('click', async function () {
        currentlyDownloading = true;
        downloadingConfirmationText.style.display = 'flex';
        differentFileButton.disabled = true;
        autoPanCheckbox.disabled = true;
        downloadButton.disabled = true;
        panSlider.disabled = true;
        speedSlider.disabled = true;
        volumeSlider.disabled = true;

        const response = await fetch(audioElement.src);
        const audioData = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(audioData);

        const sampleRate = audioBuffer.sampleRate;
        const trimStartSample = Math.floor(trimStart * audioBuffer.length);
        const trimEndSample = Math.floor(trimEnd * audioBuffer.length);
        const trimmedLength = trimEndSample - trimStartSample;

        const playbackSpeed = parseFloat(speedSlider.value) / 2;
        const adjustedLength = Math.ceil(trimmedLength / playbackSpeed);

        const offlineContext = new OfflineAudioContext({
            numberOfChannels: audioBuffer.numberOfChannels,
            length: adjustedLength,
            sampleRate: sampleRate
        });

        const trimmedBuffer = offlineContext.createBuffer(audioBuffer.numberOfChannels, trimmedLength, sampleRate);

        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const src = audioBuffer.getChannelData(channel);
            const dst = trimmedBuffer.getChannelData(channel);
            for (let i = 0; i < trimmedLength; i++) {
                dst[i] = src[trimStartSample + i];
            }
        }

        const sourceNode = offlineContext.createBufferSource();
        sourceNode.buffer = trimmedBuffer;

        // EQ in export chain
        const bassExport = offlineContext.createBiquadFilter();
        bassExport.type = 'lowshelf'; bassExport.frequency.value = 200;
        bassExport.gain.value = parseFloat(bassSlider.value);
        const midExport = offlineContext.createBiquadFilter();
        midExport.type = 'peaking'; midExport.frequency.value = 1000; midExport.Q.value = 1;
        midExport.gain.value = parseFloat(midSlider.value);
        const trebleExport = offlineContext.createBiquadFilter();
        trebleExport.type = 'highshelf'; trebleExport.frequency.value = 4000;
        trebleExport.gain.value = parseFloat(trebleSlider.value);

        // Reverb in export chain
        const reverbEx = offlineContext.createConvolver();
        reverbEx.buffer = buildImpulseResponse(offlineContext, parseFloat(reverbDecaySlider.value), 2);
        const reverbWetEx = offlineContext.createGain();
        const reverbDryEx = offlineContext.createGain();
        const reverbMixEx = offlineContext.createGain();
        const reverbMixVal = reverbToggle.checked ? parseFloat(reverbMixSlider.value) / 100 : 0;
        reverbWetEx.gain.value = reverbMixVal; reverbDryEx.gain.value = 1 - reverbMixVal;

        // Delay in export chain
        const delayEx = offlineContext.createDelay(5.0);
        delayEx.delayTime.value = parseFloat(delayTimeSlider.value);
        const delayFbEx = offlineContext.createGain();
        delayFbEx.gain.value = parseFloat(delayFeedbackSlider.value);
        const delayWetEx = offlineContext.createGain();
        const delayDryEx = offlineContext.createGain();
        const delayMixEx = offlineContext.createGain();
        delayWetEx.gain.value = delayToggle.checked ? 0.5 : 0; delayDryEx.gain.value = 1;

        // Distortion in export chain
        const distEx = offlineContext.createWaveShaper();
        distEx.curve = buildDistortionCurve(parseFloat(distortionAmountSlider.value));
        distEx.oversample = '4x';
        const distWetEx = offlineContext.createGain();
        const distDryEx = offlineContext.createGain();
        const distMixEx = offlineContext.createGain();
        distWetEx.gain.value = distortionToggle.checked ? 1 : 0;
        distDryEx.gain.value = distortionToggle.checked ? 0 : 1;

        const gainNodeExport = offlineContext.createGain();
        gainNodeExport.gain.value = parseFloat(volumeSlider.value) / 100;

        sourceNode.connect(gainNodeExport).connect(bassExport).connect(midExport).connect(trebleExport);
        trebleExport.connect(reverbDryEx).connect(reverbMixEx);
        trebleExport.connect(reverbEx).connect(reverbWetEx).connect(reverbMixEx);
        reverbMixEx.connect(delayDryEx).connect(delayMixEx);
        reverbMixEx.connect(delayEx).connect(delayWetEx).connect(delayMixEx);
        delayEx.connect(delayFbEx).connect(delayEx);
        delayMixEx.connect(distDryEx).connect(distMixEx);
        delayMixEx.connect(distEx).connect(distWetEx).connect(distMixEx);
        distMixEx.connect(offlineContext.destination);

        sourceNode.playbackRate.value = playbackSpeed;
        sourceNode.start();

        offlineContext.startRendering().then(function (renderedBuffer) {
            const audioBlob = bufferToBlob(renderedBuffer);
            const downloadLink = document.createElement("a");
            downloadLink.href = URL.createObjectURL(audioBlob);
            downloadLink.download = fileNameWithoutExtension + "[ML].wav";
            downloadingConfirmationText.textContent = "Exported Successfully!";
            downloadLink.click();
            homeRedirectButton.click();
            downloadButton.disabled = true;
        });
    });

    function bufferToBlob(renderedBuffer) {
        const numberOfChannels = renderedBuffer.numberOfChannels;
        const length = renderedBuffer.length;
        const sampleRate = renderedBuffer.sampleRate;

        const wavBuffer = new ArrayBuffer(44 + length * 2);
        const view = new DataView(wavBuffer);

        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + length * 2, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numberOfChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 4, true);
        view.setUint16(32, numberOfChannels * 2, true);
        view.setUint16(34, 16, true);
        writeString(view, 36, 'data');
        view.setUint32(40, length * 2, true);

        const offset = 44;
        const channelData = renderedBuffer.getChannelData(0);

        for (let i = 0; i < length; i++) {
            const sample = Math.max(-1, Math.min(1, channelData[i]));
            view.setInt16(offset + i * 2, sample * 0x7FFF, true);
        }

        return new Blob([view], { type: 'audio/wav' });
    }

    function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }
});