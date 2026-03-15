document.addEventListener('DOMContentLoaded', function () {

    // ─────────────────────────────────────────
    // AUDIO NODES
    // ─────────────────────────────────────────
    let audioContext, track, panner, gainNode;
    let bassFilter, midFilter, trebleFilter;
    let reverbNode, reverbWetGain, reverbDryGain;
    let delayNode, delayFeedbackGain, delayWetGain, delayDryGain;
    let distortionNode, distortionWetGain, distortionDryGain;

    let isContextInitialized = false;
    let currentlyDownloading = false;
    let slidersInitialized = false;
    let autoPanInterval;
    let cachedArrayBuffer = null;

    // ─────────────────────────────────────────
    // DOM ELEMENTS
    // ─────────────────────────────────────────
    const audioElement       = document.getElementById('audioPlayer');
    const playButton         = document.getElementById('playPauseButton');
    const downloadButton     = document.getElementById('downloadButton');
    const differentFileButton = document.getElementById('differentFileButton');
    const homeRedirectButton = document.getElementById('homeRedirectButton');
    const resetTrimButton    = document.getElementById('resetTrimButton');
    const resetAllButton     = document.getElementById('resetAllButton');

    const dataSend           = document.getElementById('dataSend');
    const fileName           = dataSend.getAttribute('fileName');
    const fileNameWithoutExtension = fileName.substring(0, fileName.lastIndexOf('.'));

    const downloadingConfirmationText = document.getElementById('downloadingConfirmationText');
    downloadingConfirmationText.style.display = 'none';
    downloadButton.disabled = true;

    // Sliders
    const inputEvent      = new Event('input');
    const volumeSlider    = document.getElementById('volumeSlider');
    const volumeSliderValue = document.getElementById('volumeValue');
    const speedSlider     = document.getElementById('speedSlider');
    const speedSliderValue = document.getElementById('speedValue');
    const panSlider       = document.getElementById('panSlider');
    const panSliderValue  = document.getElementById('panValue');
    const autoPanCheckbox = document.getElementById('autoPanCheckbox');
    autoPanCheckbox.checked = false;

    // EQ
    const bassSlider  = document.getElementById('bassSlider');
    const bassValue   = document.getElementById('bassValue');
    const midSlider   = document.getElementById('midSlider');
    const midValue    = document.getElementById('midValue');
    const trebleSlider = document.getElementById('trebleSlider');
    const trebleValue  = document.getElementById('trebleValue');

    // Effects
    const reverbToggle       = document.getElementById('reverbToggle');
    const reverbMixSlider    = document.getElementById('reverbMixSlider');
    const reverbMixValue     = document.getElementById('reverbMixValue');
    const reverbDecaySlider  = document.getElementById('reverbDecaySlider');
    const reverbDecayValue   = document.getElementById('reverbDecayValue');
    const delayToggle        = document.getElementById('delayToggle');
    const delayTimeSlider    = document.getElementById('delayTimeSlider');
    const delayTimeValue     = document.getElementById('delayTimeValue');
    const delayFeedbackSlider = document.getElementById('delayFeedbackSlider');
    const delayFeedbackValue  = document.getElementById('delayFeedbackValue');
    const distortionToggle       = document.getElementById('distortionToggle');
    const distortionAmountSlider = document.getElementById('distortionAmountSlider');
    const distortionAmountValue  = document.getElementById('distortionAmountValue');

    // Waveform
    const waveformCanvas      = document.getElementById('waveformCanvas');
    const waveformCtx         = waveformCanvas.getContext('2d');
    const waveformWrapper     = document.getElementById('waveformWrapper');
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

    // ─────────────────────────────────────────
    // WAVEFORM: LOAD & DECODE
    // ─────────────────────────────────────────
    async function loadWaveform() {
        try {
            waveformLoadingText.style.display = 'block';
            waveformLoadingText.textContent = 'Loading waveform...';
            if (!cachedArrayBuffer) {
                const response = await fetch(audioElement.src);
                cachedArrayBuffer = await response.arrayBuffer();
            }
            const audioBuffer = await audioContext.decodeAudioData(cachedArrayBuffer.slice(0));

            const rawData = audioBuffer.getChannelData(0);
            const samples = Math.min(waveformCanvas.width, 800);
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
    // WAVEFORM: DRAW
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

        // Dimmed regions outside trim
        waveformCtx.fillStyle = 'rgba(0,0,0,0.45)';
        waveformCtx.fillRect(0, 0, startX, H);
        waveformCtx.fillRect(endX, 0, W - endX, H);

        // Trim region highlight
        waveformCtx.fillStyle = 'rgba(181,136,108,0.12)';
        waveformCtx.fillRect(startX, 0, endX - startX, H);

        // Waveform bars
        const barWidth = W / waveformData.length;
        for (let i = 0; i < waveformData.length; i++) {
            const x = i * barWidth;
            const amplitude = waveformData[i] * mid * 0.9;
            const inTrim = x >= startX && x <= endX;
            const played = x < playedX;
            waveformCtx.fillStyle = !inTrim ? 'rgba(245,245,245,0.12)' : played ? '#f5f5f5' : 'rgba(245,245,245,0.4)';
            waveformCtx.fillRect(x, mid - amplitude, barWidth, amplitude * 2);
        }

        // Trim handle lines
        waveformCtx.fillStyle = '#b5886c';
        waveformCtx.fillRect(startX - 1, 0, 2, H);
        waveformCtx.fillRect(endX - 1, 0, 2, H);

        // Trim handle grips
        waveformCtx.beginPath(); waveformCtx.roundRect(startX - 5, 0, 10, 18, 3); waveformCtx.fill();
        waveformCtx.beginPath(); waveformCtx.roundRect(endX - 5, 0, 10, 18, 3); waveformCtx.fill();

        // Playhead
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
                const s = trimStart * audioElement.duration;
                const e = trimEnd * audioElement.duration;
                if (audioElement.currentTime < s) audioElement.currentTime = s;
                if (audioElement.currentTime >= e) audioElement.currentTime = s;
            }

            drawWaveform(progress);
            animationFrameId = requestAnimationFrame(frame);
        }
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = requestAnimationFrame(frame);
    }

    // ─────────────────────────────────────────
    // WAVEFORM: CANVAS RESIZE
    // ─────────────────────────────────────────
    function resizeCanvas() {
        waveformCanvas.width = waveformWrapper.clientWidth;
        waveformCanvas.height = waveformWrapper.clientHeight;
        if (waveformData) drawWaveform(audioElement.currentTime / audioElement.duration || 0);
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // ─────────────────────────────────────────
    // TRIM: DRAG HANDLES
    // ─────────────────────────────────────────
    function getMouseX(e) {
        const rect = waveformCanvas.getBoundingClientRect();
        return (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    }

    function hitTest(mouseX) {
        const W = waveformCanvas.width;
        if (Math.abs(mouseX - trimStart * W) <= HANDLE_HIT) return 'start';
        if (Math.abs(mouseX - trimEnd * W) <= HANDLE_HIT) return 'end';
        return null;
    }

    waveformCanvas.addEventListener('mousedown', e => {
        const hit = hitTest(getMouseX(e));
        if (hit) { dragging = hit; waveformCanvas.style.cursor = 'ew-resize'; }
    });

    window.addEventListener('mousemove', e => {
        if (!dragging) {
            waveformCanvas.style.cursor = hitTest(getMouseX(e)) ? 'ew-resize' : 'pointer';
            return;
        }
        const fraction = Math.max(0, Math.min(1, getMouseX(e) / waveformCanvas.width));
        if (dragging === 'start') trimStart = Math.min(fraction, trimEnd - 0.01);
        else trimEnd = Math.max(fraction, trimStart + 0.01);
    });

    window.addEventListener('mouseup', () => {
        if (!dragging) return;
        dragging = null;
        waveformCanvas.style.cursor = 'pointer';
        if (audioElement.duration) {
            const s = trimStart * audioElement.duration;
            const e = trimEnd * audioElement.duration;
            if (audioElement.currentTime < s || audioElement.currentTime > e) {
                audioElement.currentTime = s;
            }
        }
    });

    waveformCanvas.addEventListener('click', e => {
        if (hitTest(getMouseX(e))) return;
        const rect = waveformCanvas.getBoundingClientRect();
        const percent = Math.max(trimStart, Math.min(trimEnd, (e.clientX - rect.left) / waveformCanvas.width));
        audioElement.currentTime = percent * audioElement.duration;
    });

    resetTrimButton.addEventListener('click', () => {
        trimStart = 0;
        trimEnd = 1;
        if (audioElement.duration) audioElement.currentTime = 0;
    });

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
    // AUDIO CONTEXT INIT
    // Chain: track → gain → EQ → reverb → delay → distortion → panner → destination
    // ─────────────────────────────────────────
    function initializeContext() {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();

        track = audioContext.createMediaElementSource(audioElement);
        audioElement.preservesPitch = false;
        audioElement.webkitPreservesPitch = false;
        audioElement.loop = true;

        panner = new StereoPannerNode(audioContext, { pan: 0 });
        gainNode = audioContext.createGain();

        // EQ
        bassFilter = audioContext.createBiquadFilter();
        bassFilter.type = 'lowshelf'; bassFilter.frequency.value = 200; bassFilter.gain.value = 0;
        midFilter = audioContext.createBiquadFilter();
        midFilter.type = 'peaking'; midFilter.frequency.value = 1000; midFilter.Q.value = 1; midFilter.gain.value = 0;
        trebleFilter = audioContext.createBiquadFilter();
        trebleFilter.type = 'highshelf'; trebleFilter.frequency.value = 4000; trebleFilter.gain.value = 0;

        // Reverb
        reverbNode = audioContext.createConvolver();
        reverbNode.buffer = buildImpulseResponse(audioContext, parseFloat(reverbDecaySlider.value), 2);
        reverbWetGain = audioContext.createGain(); reverbWetGain.gain.value = 0;
        reverbDryGain = audioContext.createGain(); reverbDryGain.gain.value = 1;
        const reverbMix = audioContext.createGain();

        // Delay
        delayNode = audioContext.createDelay(5.0);
        delayNode.delayTime.value = parseFloat(delayTimeSlider.value);
        delayFeedbackGain = audioContext.createGain(); delayFeedbackGain.gain.value = parseFloat(delayFeedbackSlider.value);
        delayWetGain = audioContext.createGain(); delayWetGain.gain.value = 0;
        delayDryGain = audioContext.createGain(); delayDryGain.gain.value = 1;
        const delayMix = audioContext.createGain();

        // Distortion
        distortionNode = audioContext.createWaveShaper();
        distortionNode.curve = buildDistortionCurve(parseFloat(distortionAmountSlider.value));
        distortionNode.oversample = '4x';
        distortionWetGain = audioContext.createGain(); distortionWetGain.gain.value = 0;
        distortionDryGain = audioContext.createGain(); distortionDryGain.gain.value = 1;
        const distortionMix = audioContext.createGain();

        // Wire chain
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
    // SLIDER HELPERS
    // ─────────────────────────────────────────
    function initializeSliders() {
        speedSlider.value = 1;
        panSlider.value = 0;
        volumeSlider.value = 100;
        updateSliderTextValues();
    }

    function syncSlidersToAudioElement() {
        speedSlider.value = audioElement.playbackRate;
        panSlider.value = panner.pan.value;
        volumeSlider.value = gainNode.gain.value * 100;
        updateSliderTextValues();
    }

    function updateSliderTextValues() {
        volumeSliderValue.textContent = volumeSlider.value + '%';
        speedSliderValue.textContent = speedSlider.value + 'x';
        panSliderValue.textContent = panSlider.value;
    }

    // ─────────────────────────────────────────
    // PLAY / PAUSE
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

        if (audioContext.state === 'suspended') {
            audioContext.resume();
            syncSlidersToAudioElement();
        }

        if (playButton.textContent === '▶ Play') {
            if (audioElement.duration && audioElement.currentTime === 0) {
                audioElement.currentTime = trimStart * audioElement.duration;
            }
            audioElement.play();
            playButton.textContent = '⏸ Pause';
        } else {
            audioElement.pause();
            playButton.textContent = '▶ Play';
        }
    }

    playButton.addEventListener('click', togglePlayPause, false);

    // ─────────────────────────────────────────
    // SLIDER LISTENERS
    // ─────────────────────────────────────────
    volumeSlider.addEventListener('input', () => {
        updateSliderTextValues();
        if (gainNode) gainNode.gain.value = parseFloat(volumeSlider.value) / 100;
    });

    speedSlider.addEventListener('input', () => {
        updateSliderTextValues();
        audioElement.playbackRate = parseFloat(speedSlider.value);
    });

    panSlider.addEventListener('input', () => {
        updateSliderTextValues();
        if (panner) panner.pan.value = parseFloat(panSlider.value);
    });

    autoPanCheckbox.addEventListener('change', function () {
        if (this.checked) {
            panSliderValue.style.visibility = 'hidden';
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
            panSliderValue.style.visibility = 'visible';
            panSlider.step = 0.1;
            clearInterval(autoPanInterval);
            panSlider.value = 0;
            panSlider.dispatchEvent(inputEvent);
        }
    });

    // ─────────────────────────────────────────
    // EQ LISTENERS
    // ─────────────────────────────────────────
    bassSlider.addEventListener('input', () => {
        bassValue.textContent = (bassSlider.value > 0 ? '+' : '') + bassSlider.value + 'dB';
        if (bassFilter) bassFilter.gain.value = parseFloat(bassSlider.value);
    });

    midSlider.addEventListener('input', () => {
        midValue.textContent = (midSlider.value > 0 ? '+' : '') + midSlider.value + 'dB';
        if (midFilter) midFilter.gain.value = parseFloat(midSlider.value);
    });

    trebleSlider.addEventListener('input', () => {
        trebleValue.textContent = (trebleSlider.value > 0 ? '+' : '') + trebleSlider.value + 'dB';
        if (trebleFilter) trebleFilter.gain.value = parseFloat(trebleSlider.value);
    });

    // ─────────────────────────────────────────
    // EFFECTS LISTENERS
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
    // RESET ALL
    // ─────────────────────────────────────────
    resetAllButton.addEventListener('click', () => {
        volumeSlider.value = 100; volumeSlider.dispatchEvent(new Event('input'));
        speedSlider.value = 1;   speedSlider.dispatchEvent(new Event('input'));
        panSlider.value = 0;     panSlider.dispatchEvent(new Event('input'));

        if (autoPanCheckbox.checked) {
            autoPanCheckbox.checked = false;
            autoPanCheckbox.dispatchEvent(new Event('change'));
        }

        bassSlider.value = 0;   bassSlider.dispatchEvent(new Event('input'));
        midSlider.value = 0;    midSlider.dispatchEvent(new Event('input'));
        trebleSlider.value = 0; trebleSlider.dispatchEvent(new Event('input'));

        reverbToggle.checked = false; reverbToggle.dispatchEvent(new Event('change'));
        reverbMixSlider.value = 30;   reverbMixValue.textContent = '30%';
        reverbDecaySlider.value = 2;  reverbDecayValue.textContent = '2s';

        delayToggle.checked = false;   delayToggle.dispatchEvent(new Event('change'));
        delayTimeSlider.value = 0.3;   delayTimeValue.textContent = '0.3s';
        delayFeedbackSlider.value = 0.3; delayFeedbackValue.textContent = '30%';

        distortionToggle.checked = false;  distortionToggle.dispatchEvent(new Event('change'));
        distortionAmountSlider.value = 50; distortionAmountValue.textContent = '50';

        trimStart = 0; trimEnd = 1;
        if (audioElement.duration) audioElement.currentTime = 0;
    });

    // ─────────────────────────────────────────
    // KEYBOARD SHORTCUTS
    // ─────────────────────────────────────────
    document.addEventListener('keydown', e => {
        const ignoredTypes = ['text', 'password', 'email', 'number', 'search', 'tel', 'url'];
        if (e.target.tagName === 'INPUT' && ignoredTypes.includes(e.target.type)) return;

        const shortcutKeys = [' ', 'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'm', 'M', 'r', 'R'];
        if (shortcutKeys.includes(e.key)) {
            e.preventDefault();
            e.target.blur();
        }

        switch (e.key) {
            case ' ':
                togglePlayPause();
                break;
            case 'ArrowRight':
                if (audioElement.duration) audioElement.currentTime = Math.min(audioElement.currentTime + 5, trimEnd * audioElement.duration);
                break;
            case 'ArrowLeft':
                if (audioElement.duration) audioElement.currentTime = Math.max(audioElement.currentTime - 5, trimStart * audioElement.duration);
                break;
            case 'm': case 'M':
                if (gainNode) {
                    const isMuted = gainNode.gain.value === 0;
                    gainNode.gain.value = isMuted ? parseFloat(volumeSlider.value) / 100 : 0;
                    volumeSlider.style.opacity = isMuted ? '0.9' : '0.3';
                }
                break;
            case 'r': case 'R':
                trimStart = 0; trimEnd = 1;
                if (audioElement.duration) audioElement.currentTime = 0;
                break;
            case 'ArrowUp':
                volumeSlider.value = Math.min(150, parseFloat(volumeSlider.value) + 5);
                volumeSlider.dispatchEvent(new Event('input'));
                break;
            case 'ArrowDown':
                volumeSlider.value = Math.max(0, parseFloat(volumeSlider.value) - 5);
                volumeSlider.dispatchEvent(new Event('input'));
                break;
        }
    });

    // ─────────────────────────────────────────
    // EXPORT
    // ─────────────────────────────────────────
    downloadButton.addEventListener('click', async () => {
        currentlyDownloading = true;
        downloadingConfirmationText.style.display = 'flex';
        differentFileButton.disabled = true;
        autoPanCheckbox.disabled = true;
        downloadButton.disabled = true;
        panSlider.disabled = true;
        speedSlider.disabled = true;
        volumeSlider.disabled = true;

        if (!cachedArrayBuffer) {
            const response = await fetch(audioElement.src);
            cachedArrayBuffer = await response.arrayBuffer();
        }
        const audioBuffer = await audioContext.decodeAudioData(cachedArrayBuffer.slice(0));

        const sampleRate = audioBuffer.sampleRate;
        const trimStartSample = Math.floor(trimStart * audioBuffer.length);
        const trimEndSample = Math.floor(trimEnd * audioBuffer.length);
        const trimmedLength = trimEndSample - trimStartSample;
        const playbackSpeed = parseFloat(speedSlider.value) / 2;
        const adjustedLength = Math.ceil(trimmedLength / playbackSpeed);

        const offlineContext = new OfflineAudioContext({
            numberOfChannels: audioBuffer.numberOfChannels,
            length: adjustedLength,
            sampleRate
        });

        const trimmedBuffer = offlineContext.createBuffer(audioBuffer.numberOfChannels, trimmedLength, sampleRate);
        for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
            const src = audioBuffer.getChannelData(ch);
            const dst = trimmedBuffer.getChannelData(ch);
            for (let i = 0; i < trimmedLength; i++) dst[i] = src[trimStartSample + i];
        }

        const sourceNode = offlineContext.createBufferSource();
        sourceNode.buffer = trimmedBuffer;

        // EQ
        const bassEx = offlineContext.createBiquadFilter();
        bassEx.type = 'lowshelf'; bassEx.frequency.value = 200; bassEx.gain.value = parseFloat(bassSlider.value);
        const midEx = offlineContext.createBiquadFilter();
        midEx.type = 'peaking'; midEx.frequency.value = 1000; midEx.Q.value = 1; midEx.gain.value = parseFloat(midSlider.value);
        const trebleEx = offlineContext.createBiquadFilter();
        trebleEx.type = 'highshelf'; trebleEx.frequency.value = 4000; trebleEx.gain.value = parseFloat(trebleSlider.value);

        // Reverb
        const reverbEx = offlineContext.createConvolver();
        reverbEx.buffer = buildImpulseResponse(offlineContext, parseFloat(reverbDecaySlider.value), 2);
        const reverbWetEx = offlineContext.createGain();
        const reverbDryEx = offlineContext.createGain();
        const reverbMixEx = offlineContext.createGain();
        const reverbMixVal = reverbToggle.checked ? parseFloat(reverbMixSlider.value) / 100 : 0;
        reverbWetEx.gain.value = reverbMixVal; reverbDryEx.gain.value = 1 - reverbMixVal;

        // Delay
        const delayEx = offlineContext.createDelay(5.0);
        delayEx.delayTime.value = parseFloat(delayTimeSlider.value);
        const delayFbEx = offlineContext.createGain(); delayFbEx.gain.value = parseFloat(delayFeedbackSlider.value);
        const delayWetEx = offlineContext.createGain(); const delayDryEx = offlineContext.createGain();
        const delayMixEx = offlineContext.createGain();
        delayWetEx.gain.value = delayToggle.checked ? 0.5 : 0; delayDryEx.gain.value = 1;

        // Distortion
        const distEx = offlineContext.createWaveShaper();
        distEx.curve = buildDistortionCurve(parseFloat(distortionAmountSlider.value)); distEx.oversample = '4x';
        const distWetEx = offlineContext.createGain(); const distDryEx = offlineContext.createGain();
        const distMixEx = offlineContext.createGain();
        distWetEx.gain.value = distortionToggle.checked ? 1 : 0;
        distDryEx.gain.value = distortionToggle.checked ? 0 : 1;

        const gainEx = offlineContext.createGain(); gainEx.gain.value = parseFloat(volumeSlider.value) / 100;

        sourceNode.connect(gainEx).connect(bassEx).connect(midEx).connect(trebleEx);
        trebleEx.connect(reverbDryEx).connect(reverbMixEx);
        trebleEx.connect(reverbEx).connect(reverbWetEx).connect(reverbMixEx);
        reverbMixEx.connect(delayDryEx).connect(delayMixEx);
        reverbMixEx.connect(delayEx).connect(delayWetEx).connect(delayMixEx);
        delayEx.connect(delayFbEx).connect(delayEx);
        delayMixEx.connect(distDryEx).connect(distMixEx);
        delayMixEx.connect(distEx).connect(distWetEx).connect(distMixEx);
        distMixEx.connect(offlineContext.destination);

        sourceNode.playbackRate.value = playbackSpeed;
        sourceNode.start();

        offlineContext.startRendering().then(renderedBuffer => {
            const blob = bufferToBlob(renderedBuffer);
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = fileNameWithoutExtension + '[ML].wav';
            downloadingConfirmationText.textContent = 'Exported Successfully!';
            link.click();
            homeRedirectButton.click();
            downloadButton.disabled = true;
        });
    });

    // ─────────────────────────────────────────
    // WAV ENCODING
    // ─────────────────────────────────────────
    function bufferToBlob(renderedBuffer) {
        const { numberOfChannels, length, sampleRate } = renderedBuffer;
        const wavBuffer = new ArrayBuffer(44 + length * 2);
        const view = new DataView(wavBuffer);

        writeString(view, 0, 'RIFF'); view.setUint32(4, 36 + length * 2, true);
        writeString(view, 8, 'WAVE'); writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true); view.setUint16(20, 1, true);
        view.setUint16(22, numberOfChannels, true); view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 4, true); view.setUint16(32, numberOfChannels * 2, true);
        view.setUint16(34, 16, true); writeString(view, 36, 'data'); view.setUint32(40, length * 2, true);

        const channelData = renderedBuffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
            view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, channelData[i])) * 0x7FFF, true);
        }
        return new Blob([view], { type: 'audio/wav' });
    }

    function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
    }

});