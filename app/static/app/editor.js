document.addEventListener('DOMContentLoaded', function () {
    // WEB AUDIO API ELEMENTS
    let AudioContext;
    let audioContext;
    let track;
    let pannerOptions;
    let panner;
    let gainNode;
    let offlineAudioContext;
    const playBar = document.getElementById('playBar');
    const playBarContainer = document.getElementById('playBarContainer');
    playBarContainer.style.display = 'flex';
    const audioElement = document.getElementById('audioPlayer');
    let isContextInitialized = false;
    let currentlyDownloading = false;

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
    const allSlidersContainer = document.getElementById('allSlidersContainer');
    allSlidersContainer.style.display = 'flex';
    let slidersInitialized = false;
    const inputEvent = new Event('input');
    const volumeSlider = document.getElementById('volumeSlider');
    const volumeSliderValue = document.getElementById('volumeValue');
    const speedSliderValue = document.getElementById('speedValue');
    const panSliderValue = document.getElementById('panValue');
    const speedSlider = document.getElementById('speedSlider');
    const panSlider = document.getElementById('panSlider');

    // TEXT ELEMENTS
    const panWarningText = document.getElementById('panWarningText');
    panWarningText.style.display = 'flex';
    downloadingConfirmationText = document.getElementById('downloadingConfirmationText');
    downloadingConfirmationText.style.display = 'none';

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

    // WEB AUDIO API START
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

        track.connect(gainNode).connect(panner).connect(audioContext.destination);

        // VISUALISER
        function drawPlayBar() {
            const percentComplete = (audioElement.currentTime / audioElement.duration) * 100;

            playBar.style.width = `${percentComplete}%`;
        
            playBarContainer.addEventListener('click', function (e) {
                const percentClicked = e.offsetX / this.clientWidth;
                const newTime = percentClicked * audioElement.duration;
                console.log('Time set to:', newTime)
                audioElement.currentTime = newTime;
            });
        
            requestAnimationFrame(drawPlayBar);
        }

        drawPlayBar();
    }

    // PLAY BUTTON CLICK (FIRST TIME INITIALISE SOME THINGS)
    playButton.addEventListener("click", () => {

        if (!isContextInitialized) {
            initializeContext();
            isContextInitialized = true;
        }

        if (!currentlyDownloading) {
            downloadButton.disabled = false;
        }
        panWarningText.style.display = 'none';

        if (!slidersInitialized) {
            initializeSliders();
            slidersInitialized = true;
        }

        if (audioContext.state === "suspended") {
            audioContext.resume();
            syncSlidersToAudioElement();
        }

        // PLAY/PAUSE FUNCTIONALITY
        if (playButton.textContent === "Play") {
            console.log('Playing')
            audioElement.play();
            playButton.textContent = "Pause";
        } else if (playButton.textContent === "Pause") {
            console.log('Paused')
            audioElement.pause();
            playButton.textContent = "Play";
        }
    }, false);

    // DETECT SPEED SLIDER CHANGE
    speedSlider.addEventListener('input', function () {
        updateSliderTextValues();
        const speedValue = parseFloat(speedSlider.value).toFixed(2);
        console.log('Speed set to:', speedValue)
        audioElement.playbackRate = speedValue;
    });

    // DETECT PAN SLIDER CHANGE
    panSlider.addEventListener('input', function () {
        updateSliderTextValues();
        const panValue = parseFloat(panSlider.value).toFixed(2);
        panner.pan.value = panValue;
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
                    currentPanValue = (currentPanValue >= 1) ? 1 : -1;
                }
    
                panSlider.value = currentPanValue.toFixed(2);
                panSlider.dispatchEvent(inputEvent);
    
                if (!autoPanCheckbox.checked) {
                    clearInterval(autoPanInterval);
                }
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
        const gainValue = parseFloat(volumeSlider.value).toFixed(2);
        gainNode.gain.value = gainValue / 100;
    });

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
    
        const playbackSpeed = parseFloat(speedSlider.value).toFixed(2) / 2;
        const adjustedLength = Math.ceil(audioBuffer.length / playbackSpeed);
    
        const offlineContext = new OfflineAudioContext({
            numberOfChannels: audioBuffer.numberOfChannels,
            length: adjustedLength,
            sampleRate: audioBuffer.sampleRate
        });
    
        const sourceNode = offlineContext.createBufferSource();
        const adjustedBuffer = offlineContext.createBuffer(audioBuffer.numberOfChannels, adjustedLength, audioBuffer.sampleRate);
    
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const oldChannelData = audioBuffer.getChannelData(channel);
            const newChannelData = adjustedBuffer.getChannelData(channel);
            for (let i = 0; i < oldChannelData.length; i++) {
                newChannelData[i] = oldChannelData[i];
            }
        }
    
        sourceNode.buffer = adjustedBuffer;
    
        const gainNodeExport = offlineContext.createGain();
        gainNodeExport.gain.value = parseFloat(volumeSlider.value).toFixed(2) / 100;
    
        sourceNode.connect(gainNodeExport);
        gainNodeExport.connect(offlineContext.destination);
        sourceNode.playbackRate.value = playbackSpeed;
    
        sourceNode.start();
    
        offlineContext.startRendering().then(function (renderedBuffer) {
            const audioBlob = bufferToBlob(renderedBuffer);
    
            const downloadLink = document.createElement("a");
            downloadLink.href = URL.createObjectURL(audioBlob);
            downloadLink.download = (fileNameWithoutExtension + "[ML].wav");
            downloadingConfirmationText.textContent = "Exported Successfully!";
            downloadLink.click();

            homeRedirectButton.click();
            downloadButton.disabled = true;
        });
    });
    
    

    // PART OF AUDIO DOWNLOAD (RELATED TO DOWNLOAD BUTTON)
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
    
        let maxAmplitude = 0;
    
        for (let i = 0; i < length; i++) {
            const sample = Math.max(-1, Math.min(1, channelData[i]));
            view.setInt16(offset + i * 2, sample * 0x7FFF, true);
    
            if (Math.abs(sample) > maxAmplitude) {
                maxAmplitude = Math.abs(sample);
            }
        }
    
        const audioBlob = new Blob([view], { type: 'audio/wav' });    
        return audioBlob;
    }

    // PART OF AUDIO DOWNLOAD (RELATED TO DOWNLOAD BUTTON)
    function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }
});
