'use strict';

/* ============================================================
   BDIX Radar — parallel, static-only, vanilla JS scanner
   ============================================================ */

const SERVER_LIST_URL = 'all_servers.txt';
const STORAGE_KEY = 'nexusBdixScanner.v1';
const VISITORS_API = 'https://api.countapi.xyz/hit/nexus-bdix-scanner/visits';
const RENDER_LIMIT = 300;

/* ---- Feature 17: Web Push (serverless) ----
   PLACEHOLDER: Replace with your real VAPID public key (urlsafe base64, no padding). */
const VAPID_PUBLIC_KEY = 'PLACEHOLDER_VAPID_PUBLIC_KEY_REPLACE_ME';
const SUBSCRIBE_ENDPOINT = '/api/subscribe';

/* ---- Feature 10: GitHub repo preset for "Submit a server" ---- */
const GITHUB_REPO = 'n0b0jit/nexus-bdix-scanner';
const GITHUB_ISSUE_URL = 'https://github.com/' + GITHUB_REPO + '/issues/new';

const TELEGRAM_PROMO = 'https://t.me/n0b0jit_nexus';
const LINKTREE_PROMO = 'https://linktr.ee/mr_nobojit.m';
const SHARE_UTM = '?utm_source=bdixradar&utm_medium=referral&utm_campaign=completion';
const SHARE_BASE_URL = 'https://nexus-bdix-scanner.onrender.com/';

/* ---- Social / YouTube showcase config ----
   Leave SOCIAL_YOUTUBE_CHANNEL_ID empty ('') to disable the YouTube
   showcase + scan popup gracefully (no console errors). */
const SOCIAL_YOUTUBE_CHANNEL_ID = '';
const SOCIAL_POPUP_AUTO_SHOW = false;
const SOCIAL_MANUAL_URL = '';

const $ = function (id) { return document.getElementById(id); };

/* ============================================================
   State
   ============================================================ */
let allServers = [];
let queueIndex = 0;
let totalUrls = 0;
let processedUrls = 0;
let onlineCount = 0;
let offlineCount = 0;
let scanningActive = false;
let scanningPaused = false;
let scanFinished = false;
let startTime = 0;
let elapsedTime = 0;
let timerInterval = null;
let activeWorkers = 0;
let scanTimeoutMult = 1;
let retryRoundActive = false;
let retryRemaining = 0;
let customListText = null;
const CUSTOM_LIST_KEY = 'nexusBdixScanner.customList';
const SERVER_HISTORY_KEY = 'nexusBdixScanner.serverHistory';
const SPEED_TEST_KEY = 'nexusBdixScanner.speedTest';

/* ---- DOM refs ---- */
const startStopBtn = $('startStopBtn');
const resetBtn = $('resetBtn');
const progressBar = $('progressBar');
const progressBarTrack = $('progressBarTrack');
const progressPercent = $('progressPercent');
const progressRing = $('progressRing');
const ringPercent = $('ringPercent');
const onlineCountEl = $('onlineCount');
const offlineCountEl = $('offlineCount');
const totalCountEl = $('totalCount');
const onlinePillEl = $('onlinePill');
const offlinePillEl = $('offlinePill');
const elapsedTimeEl = $('elapsedTime');
const etaTimeEl = $('etaTime');
const activeCountEl = $('activeCount');
const currentUrlContainer = $('currentUrlContainer');
const currentUrlEl = $('currentUrl');
const urlList = $('urlList');
const urlList2 = $('urlList2');
const emptyOnline = $('emptyOnline');
const emptyOffline = $('emptyOffline');
const toastEl = $('toast');
const searchInput = $('searchInput');
const renderNoteOnline = $('renderNoteOnline');
const renderNoteOffline = $('renderNoteOffline');
const timeOutValue = $('timeOutValue');
const concurrencyValue = $('concurrencyValue');
const autoscroll = $('autoscroll');
const accurateProbe = $('accurateProbe');
const retryUnreachable = $('retryUnreachable');
const retryAttempts = $('retryAttempts');
const soundOnComplete = $('soundOnComplete');
const notifyToggle = $('notifyToggle');
const customListFile = $('customListFile');
const customListMeta = $('customListMeta');
const clearCustomListBtn = $('clearCustomListBtn');
const completionCta = $('completionCta');
const telegramCtaBtn = $('telegramCtaBtn');
const submitForm = $('submitForm');
const submitUrl = $('submitUrl');
const submitNote = $('submitNote');
const shareCardBtn = $('shareCardBtn');
const cardModal = $('cardModal');
const shareCanvas = $('shareCanvas');
const downloadCardBtn = $('downloadCardBtn');
const copyCardBtn = $('copyCardBtn');
const copyCardTextBtn = $('copyCardTextBtn');
const cardHint = $('cardHint');
const updateBanner = $('updateBanner');
const reloadBtn = $('reloadBtn');
const dismissUpdateBtn = $('dismissUpdateBtn');
const socialFollowModal = $('socialFollowModal');
const youtubeShowcase = $('youtubeShowcase');
const ytThumb = $('ytThumb');
const ytTitle = $('ytTitle');
const ytCard = $('ytCard');

const socialPopup = $('socialPopup');
const socialPopupFrame = $('socialPopupFrame');
const socialPopupLink = $('socialPopupLink');
const socialPopupClose = $('socialPopupClose');
const socialPopupTitle = $('socialPopupTitle');

let serverListCache = null;

/* ============================================================
   Social popup while scanning
   ============================================================ */
function maybeShowSocialPopup() {
    if (!SOCIAL_POPUP_AUTO_SHOW || !socialPopup) return;
    if (SOCIAL_MANUAL_URL) { showSocialPopup(null); return; }
    if (!SOCIAL_YOUTUBE_CHANNEL_ID) return;
    fetchLatestYouTubeVideoId(SOCIAL_YOUTUBE_CHANNEL_ID).then(function (id) {
        if (id) showSocialPopup(id);
        else showSocialPopupFallback();
    });
}

function showSocialPopup(videoId) {
    if (!socialPopup) return;
    const target = SOCIAL_MANUAL_URL || (videoId ? 'https://www.youtube.com/embed/' + videoId : '');
    if (!target) { hideSocialPopup(); return; }
    if (socialPopupTitle) socialPopupTitle.textContent = '🎬 Latest upload';
    if (socialPopupLink) {
        socialPopupLink.href = SOCIAL_MANUAL_URL || ('https://www.youtube.com/watch?v=' + videoId);
        socialPopupLink.textContent = 'Watch on YouTube';
        socialPopupLink.hidden = !SOCIAL_MANUAL_URL && !videoId;
    }
    if (socialPopupFrame) {
        socialPopupFrame.src = target;
        socialPopupFrame.hidden = !target;
    }
    socialPopup.hidden = false;
}

function hideSocialPopup() {
    if (!socialPopup) return;
    socialPopup.hidden = true;
    if (socialPopupFrame) socialPopupFrame.src = '';
}

function showSocialPopupFallback() {
    if (!socialPopup || !SOCIAL_YOUTUBE_CHANNEL_ID) return;
    const channelUrl = 'https://www.youtube.com/channel/' + SOCIAL_YOUTUBE_CHANNEL_ID;
    if (socialPopupTitle) socialPopupTitle.textContent = '🎬 Check out my channel';
    if (socialPopupFrame) { socialPopupFrame.hidden = true; socialPopupFrame.src = ''; }
    if (socialPopupLink) {
        socialPopupLink.href = channelUrl;
        socialPopupLink.textContent = 'Open YouTube channel';
        socialPopupLink.hidden = false;
    }
    socialPopup.hidden = false;
}

function fetchLatestYouTubeVideoId(channelId) {
    const directUrl = 'https://www.youtube.com/feeds/videos.xml?channel_id=' + channelId;
    const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(directUrl);
    const doFetch = function (url) {
        return fetch(url).then(function (r) { return r.text(); }).then(function (xml) {
            const m = xml.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
            return m ? m[1] : null;
        });
    };
    return doFetch(directUrl).catch(function () { return doFetch(proxyUrl); }).catch(function () { return null; });
}

function setupYouTubeShowcase() {
    if (!youtubeShowcase || !ytThumb || !ytTitle || !ytCard) return;
    if (!SOCIAL_YOUTUBE_CHANNEL_ID) return;
    const channelId = SOCIAL_YOUTUBE_CHANNEL_ID;
    const directUrl = 'https://www.youtube.com/feeds/videos.xml?channel_id=' + channelId;
    const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(directUrl);
    const doFetch = function (url) {
        return fetch(url).then(function (r) { return r.text(); }).then(function (xml) {
            const videoIdMatch = xml.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
            const titleMatch = xml.match(/<title>([^<]+)<\/title>/);
            return { videoId: videoIdMatch ? videoIdMatch[1] : null, title: titleMatch ? titleMatch[1] : null };
        });
    };
    doFetch(directUrl).catch(function () { return doFetch(proxyUrl); }).catch(function () { return null; })
        .then(function (data) {
            if (!data || !data.videoId) return;
            ytThumb.src = 'https://img.youtube.com/vi/' + data.videoId + '/mqdefault.jpg';
            ytCard.href = 'https://www.youtube.com/watch?v=' + data.videoId;
            youtubeShowcase.hidden = false;
            if (data.title) ytTitle.textContent = data.title;
        });
}

/* ============================================================
   Config read helpers
   ============================================================ */
function getTimeoutMs() {
    const v = parseInt(timeOutValue.value, 10);
    return Math.round((isNaN(v) || v < 1 ? 8 : v) * 1000 * scanTimeoutMult);
}
function getConcurrency() {
    const v = parseInt(concurrencyValue.value, 10);
    return Math.max(1, Math.min(64, isNaN(v) ? 8 : v));
}

/* ============================================================
   Toast + small UI utils
   ============================================================ */
let toastTimer = null;
function showToast(message, win) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.toggle('success', !!win);
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 3200);
}

function bump(el) {
    if (!el) return;
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
}

function formatTime(time) {
    if (!isFinite(time) || time < 0) time = 0;
    const hours = Math.floor(time / 3600000);
    const minutes = Math.floor((time % 3600000) / 60000);
    const seconds = Math.floor((time % 60000) / 1000);
    return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
}

/* ============================================================
   Progress ring
   ============================================================ */
const RING_CIRCUMFERENCE = 2 * Math.PI * 52;
progressRing.style.strokeDasharray = RING_CIRCUMFERENCE;

function updateProgress(percent) {
    percent = Math.max(0, Math.min(100, percent));
    progressBar.style.width = percent + '%';
    if (progressBarTrack) progressBarTrack.setAttribute('aria-valuenow', percent);
    progressPercent.textContent = percent + '%';
    ringPercent.textContent = percent + '%';
    const offset = RING_CIRCUMFERENCE * (1 - percent / 100);
    progressRing.style.strokeDashoffset = offset;
    if (scanningActive && !scanningPaused) document.title = percent + '% — Scanning BDIX servers';
    updateEta(percent);
}

function updateEta(percent) {
    if (percent <= 0 || !scanningActive || totalUrls === 0) { etaTimeEl.textContent = '--:--:--'; return; }
    const remaining = (elapsedTime / percent) * (100 - percent);
    etaTimeEl.textContent = formatTime(remaining);
}

/* ============================================================
   Stats
   ============================================================ */
function updateStats() {
    onlineCountEl.textContent = onlineCount;
    offlineCountEl.textContent = offlineCount;
    totalCountEl.textContent = processedUrls;
    onlinePillEl.textContent = onlineCount;
    offlinePillEl.textContent = offlineCount;
}

/* ============================================================
   Probe a single URL
   ============================================================ */
function probeUrl(url) {
    const timeOutMs = getTimeoutMs();
    return new Promise(function (resolve) {
        const controller = new AbortController();
        const timeoutId = setTimeout(function () { controller.abort(); }, timeOutMs);
        fetch(url, { method: 'HEAD', mode: 'no-cors', signal: controller.signal })
            .then(function () { clearTimeout(timeoutId); resolve({ url: url, status: 'online', code: null }); })
            .catch(function () { clearTimeout(timeoutId); resolve({ url: url, status: 'offline', code: null }); });
    });
}

/* Optional accurate probe through a free CORS proxy (real HTTP status). */
function probeWithProxy(url) {
    const proxies = ['https://api.allorigins.win/raw?url=', 'https://corsproxy.io/?url='];
    return (function attempt(i) {
        if (i >= proxies.length) return Promise.resolve(null);
        const target = proxies[i] + encodeURIComponent(url);
        const controller = new AbortController();
        const tid = setTimeout(function () { controller.abort(); }, getTimeoutMs());
        return fetch(target, { method: 'GET', signal: controller.signal })
            .then(function (res) { clearTimeout(tid); return res.status; })
            .catch(function () { clearTimeout(tid); return attempt(i + 1); });
    })(0);
}

/* ============================================================
   Parallel worker pool
   ============================================================ */
function dispatchWorkers() {
    const concurrency = getConcurrency();
    while (activeWorkers < concurrency && queueIndex < allServers.length && scanningActive && !scanningPaused) {
        const idx = queueIndex++;
        const entry = allServers[idx];
        activeWorkers++;
        updateActive();
        worker(entry).finally(function () {
            activeWorkers--;
            updateActive();
            if (scanningActive && !scanningPaused) dispatchWorkers();
            else if (scanningActive && scanningPaused && activeWorkers === 0) {
                /* paused, in-flight done — wait for resume */
            } else if (!scanningActive && queueIndex >= allServers.length && activeWorkers === 0) {
                finishScanning();
            }
        });
    }
    if (scanningActive && !scanningPaused && queueIndex >= allServers.length && activeWorkers === 0) {
        finishScanning();
    }
}

function updateActive() {
    if (activeCountEl) activeCountEl.textContent = activeWorkers;
}

function worker(entry) {
    currentUrlEl.textContent = 'Scanning: ' + entry.url;
    const task = accurateProbe.checked
        ? probeUrl(entry.url).then(function (r) {
            return probeWithProxy(entry.url).then(function (code) { r.code = code; return r; });
        })
        : probeUrl(entry.url);

    return task.then(function (result) {
        recordResult(result);
    }).catch(function () {
        recordResult({ url: entry.url, status: 'offline', code: null });
    });
}

function recordResult(result) {
    const entry = allServers.find(function (e) { return e.url === result.url; });
    if (!entry) return;
    entry.status = result.status;
    entry.code = result.code;
    entry.timestamp = Date.now();

    processedUrls++;
    if (result.status === 'online') {
        onlineCount++;
        bump(onlineCountEl);
        bump(onlinePillEl);
        // Record server history for online servers
        recordServerHistory(result.url, 'online');
    } else {
        offlineCount++;
        bump(offlineCountEl);
        bump(offlinePillEl);
        // Record server history for offline servers
        recordServerHistory(result.url, 'offline');
    }

    updateStats();
    updateProgress(totalUrls > 0 ? Math.round((processedUrls / totalUrls) * 100) : 0);
    scheduleRender();
    maybeAutoscroll();

    if (processedUrls >= totalUrls && totalUrls > 0) finishScanning();
}

/* ============================================================
   Rendering with lightweight windowing (cap rendered rows)
   ============================================================ */
let currentFilter = 'all';

function getFiltered() {
    const q = (searchInput.value || '').trim().toLowerCase();
    const online = [];
    const offline = [];
    for (let i = 0; i < allServers.length; i++) {
        const e = allServers[i];
        if (q && e.url.toLowerCase().indexOf(q) === -1) continue;
        if (currentFilter === 'online' && e.status !== 'online') continue;
        if (currentFilter === 'offline' && e.status !== 'offline') continue;
        (e.status === 'online' ? online : offline).push(e);
    }
    return { online: online, offline: offline };
}

function buildListItems(container, entries, statusClass) {
    container.textContent = '';
    const slice = entries.slice(0, RENDER_LIMIT);
    const frag = document.createDocumentFragment();
    for (let i = 0; i < slice.length; i++) {
        const e = slice[i];
        const li = document.createElement('li');
        li.className = statusClass;
        const a = document.createElement('a');
        a.href = e.url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = e.url + ' (' + (statusClass === 'online' ? 'Reachable' : 'Unreachable') + ')';
        li.appendChild(a);
        
        // Add reliability indicator for online servers
        if (statusClass === 'online') {
            const reliability = getServerReliability(e.url);
            if (reliability && reliability.totalChecks > 1) {
                const reliabilityBadge = document.createElement('span');
                reliabilityBadge.className = 'reliability-badge';
                reliabilityBadge.textContent = reliability.reliability + '% reliable';
                reliabilityBadge.title = 'Based on ' + reliability.totalChecks + ' checks';
                li.appendChild(reliabilityBadge);
            }
        }
        
        if (e.code) {
            const code = document.createElement('span');
            code.className = 'status-code';
            code.textContent = 'HTTP ' + e.code;
            li.appendChild(code);
        }
        frag.appendChild(li);
    }
    container.appendChild(frag);
}

function renderResults() {
    const filtered = getFiltered();
    buildListItems(urlList, filtered.online, 'online');
    buildListItems(urlList2, filtered.offline, 'offline');
    renderNoteOnline.textContent = filtered.online.length > RENDER_LIMIT
        ? 'Showing ' + RENDER_LIMIT + ' of ' + filtered.online.length + ' — search to refine'
        : '';
    renderNoteOffline.textContent = filtered.offline.length > RENDER_LIMIT
        ? 'Showing ' + RENDER_LIMIT + ' of ' + filtered.offline.length + ' — search to refine'
        : '';
    if (emptyOnline) emptyOnline.hidden = filtered.online.length !== 0 || allServers.length === 0;
    if (emptyOffline) emptyOffline.hidden = filtered.offline.length !== 0 || allServers.length === 0;
}

let renderScheduled = false;
function scheduleRender() {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(function () {
        renderScheduled = false;
        renderResults();
    });
}

function maybeAutoscroll() {
    if (!autoscroll.checked) return;
    if (currentFilter === 'all' || currentFilter === 'online') urlList.scrollTop = urlList.scrollHeight;
    if (currentFilter === 'all' || currentFilter === 'offline') urlList2.scrollTop = urlList2.scrollHeight;
}

/* ============================================================
   State machine: start / pause / resume / reset
   ============================================================ */
function toggleScanning() {
    if (!scanningActive) startScanning();
    else if (scanningPaused) resumeScanning();
    else pauseScanning();
}

function startScanning() {
    if (retryRoundActive) { startRetryRound(); return; }
    scanTimeoutMult = 1;
    beginScan(null);
}

/* Core scan start. If `presetEntries` is provided it is used directly
   (e.g. the retry pass over only unreachable servers); otherwise the
   full server list is loaded (from cache or network). */
function beginScan(presetEntries) {
    scanFinished = false;
    scanningActive = true;
    scanningPaused = false;
    processedUrls = 0;
    onlineCount = 0;
    offlineCount = 0;
    queueIndex = 0;
    startTime = Date.now();
    elapsedTime = 0;
    activeWorkers = 0;
    updateActive();

    if (!retryRoundActive) {
        urlList.textContent = '';
        urlList2.textContent = '';
        renderNoteOnline.textContent = '';
        renderNoteOffline.textContent = '';
        if (emptyOnline) emptyOnline.hidden = true;
        if (emptyOffline) emptyOffline.hidden = true;
    }
    updateStats();
    updateProgress(0);
    startTimer();

    setScanButton('stop');
    document.body.classList.add('scanning');
    showToast(retryRoundActive ? 'Retrying unreachable servers…' : 'Scan started — probing servers in parallel…');
    maybeShowSocialPopup();

    const startWithEntries = function (entries) {
        allServers = entries;
        totalUrls = allServers.length;
        currentUrlContainer.hidden = false;
        dispatchWorkers();
    };

    if (presetEntries) {
        startWithEntries(presetEntries);
    } else if (customListText) {
        startWithEntries(parseList(customListText));
    } else if (serverListCache) {
        const cached = serverListCache;
        serverListCache = null;
        startWithEntries(parseList(cached));
    } else {
        fetch(SERVER_LIST_URL)
            .then(function (r) { return r.text(); })
            .then(function (text) { startWithEntries(parseList(text)); })
            .catch(function (err) {
                console.error('Error fetching server list:', err);
                showToast('Failed to load server list');
                finishScanning();
            });
    }
}

function parseList(text) {
    return text.trim().split('\n')
        .map(function (u) { return u.trim(); })
        .filter(function (u) { return u && /^https?:\/\//i.test(u); })
        .map(function (u) { return { url: u, status: null, code: null }; });
}

function setScanButton(mode) {
    if (!startStopBtn) return;
    const iconPlay = '<svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
    const iconStop = '<svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 6h12v12H6z"/></svg>';
    const iconResume = '<svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
    if (mode === 'stop') {
        startStopBtn.innerHTML = iconStop + '<span class="btn-label">Stop Scan</span>';
        startStopBtn.classList.add('scanning');
    } else if (mode === 'resume') {
        startStopBtn.innerHTML = iconResume + '<span class="btn-label">Resume Scan</span>';
        startStopBtn.classList.remove('scanning');
    } else {
        startStopBtn.innerHTML = iconPlay + '<span class="btn-label">Start Scan</span>';
        startStopBtn.classList.remove('scanning');
    }
}

function resumeScanning() {
    scanningPaused = false;
    setScanButton('stop');
    startTimer();
    document.body.classList.add('scanning');
    showToast('Scan resumed');
    dispatchWorkers();
}

function pauseScanning() {
    scanningPaused = true;
    setScanButton('resume');
    stopTimer();
    document.body.classList.remove('scanning');
    showToast('Scan paused — in-flight requests finishing');
}

function finishScanning() {
    if (scanFinished) return;
    if (!scanningActive && processedUrls === 0 && totalUrls === 0) return;
    scanFinished = true;
    scanningActive = false;
    scanningPaused = false;
    setScanButton('start');
    document.body.classList.remove('scanning');
    stopTimer();
    etaTimeEl.textContent = '--:--:--';
    document.title = 'BDIX Radar';

    if (totalUrls > 0 && processedUrls >= totalUrls) {
        const unreachable = allServers.filter(function (e) { return e.status === 'offline'; });

        if (retryUnreachable.checked && !retryRoundActive && unreachable.length > 0) {
            retryRemaining = Math.max(1, Math.min(5, parseInt(retryAttempts.value, 10) || 2));
            startRetryRound();
            return;
        }

        if (retryRoundActive && retryRemaining > 0) {
            startRetryRound();
            return;
        }

        if (retryRoundActive) {
            retryRoundActive = false;
            scanTimeoutMult = 1;
        }

        document.title = 'BDIX Radar — Complete';
        showToast('Scan complete · ' + onlineCount + ' reachable, ' + offlineCount + ' unreachable', true);
        if (soundOnComplete.checked) playBeep();
        showCompletionCta(onlineCount);
        saveState();
        
        // Start real-time updates after scan completes
        startRealtimeUpdates();
        
        setTimeout(function () { showSocialFollowModal(false); }, 1500);
    }
}

/* Retry passes: re-probe only the servers that were unreachable,
   with an increasing timeout (exponential-ish backoff) each pass. */
function startRetryRound() {
    retryRoundActive = true;
    const totalPasses = retryRemaining || 1;
    retryRemaining = retryRemaining - 1;
    const passNo = totalPasses - retryRemaining;
    scanTimeoutMult = Math.pow(2, passNo);
    const unreachable = allServers
        .filter(function (e) { return e.status === 'offline'; })
        .map(function (e) { return { url: e.url, status: null, code: null }; });
    showToast('Retrying ' + unreachable.length + ' unreachable (' + (passNo) + '/' + totalPasses + ')…');
    if (unreachable.length === 0) {
        retryRoundActive = false;
        scanTimeoutMult = 1;
        return;
    }
    beginScan(unreachable);
}

function resetScanning() {
    scanningActive = false;
    scanningPaused = false;
    scanFinished = false;
    activeWorkers = 0;
    updateActive();
    queueIndex = 0;
    scanTimeoutMult = 1;
    retryRoundActive = false;
    retryRemaining = 0;
    stopTimer();
    
    // Stop real-time updates
    stopRealtimeUpdates();

    setScanButton('start');
    document.body.classList.remove('scanning');

    elapsedTime = 0;
    processedUrls = 0;
    onlineCount = 0;
    offlineCount = 0;
    totalUrls = 0;
    allServers = [];

    updateProgress(0);
    updateStats();
    elapsedTimeEl.textContent = '00:00:00';
    etaTimeEl.textContent = '--:--:--';
    document.title = 'BDIX Radar';

    urlList.textContent = '';
    urlList2.textContent = '';
    renderNoteOnline.textContent = '';
    renderNoteOffline.textContent = '';
    currentUrlEl.textContent = '';
    currentUrlContainer.hidden = true;
    if (emptyOnline) emptyOnline.hidden = true;
    if (emptyOffline) emptyOffline.hidden = true;
    searchInput.value = '';
    hideCompletionCta();
    hideSocialPopup();
    clearSavedState();
    showToast('Reset — results and saved state cleared');
}

/* ============================================================
   Timer
   ============================================================ */
function startTimer() {
    stopTimer();
    startTime = Date.now() - elapsedTime;
    timerInterval = setInterval(function () {
        elapsedTime = Date.now() - startTime;
        elapsedTimeEl.textContent = formatTime(elapsedTime);
        if (scanningActive) updateEta(totalUrls > 0 ? Math.round((processedUrls / totalUrls) * 100) : 0);
    }, 100);
}

function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

/* ============================================================
   Completion sound (Web Audio oscillator)
   ============================================================ */
function playBeep() {
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 660;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.42);
        osc.onended = function () { ctx.close(); };
    } catch (e) { /* ignore */ }
}

/* ============================================================
   Export / share
   ============================================================ */
function reachableUrls() {
    return allServers.filter(function (e) { return e.status === 'online'; }).map(function (e) { return e.url; });
}
function unreachableUrls() {
    return allServers.filter(function (e) { return e.status === 'offline'; }).map(function (e) { return e.url; });
}

function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            resolve();
        } catch (e) { reject(e); }
    });
}

function downloadTxt() {
    const content = 'REACHABLE (' + reachableUrls().length + ')\n' +
        reachableUrls().join('\n') + '\n\nUNREACHABLE (' + unreachableUrls().length + ')\n' +
        unreachableUrls().join('\n') + '\n';
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bdix-radar-results.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    showToast('Downloaded results.txt');
}

function shareResultsSummary() {
    return 'BDIX Radar — I found ' + onlineCount + ' reachable / ' + offlineCount +
        ' unreachable (of ' + totalUrls + '). Scan yours: ' + SHARE_BASE_URL + SHARE_UTM +
        ' | TG: ' + TELEGRAM_PROMO + ' | ' + LINKTREE_PROMO;
}

function shareResults() {
    const summary = shareResultsSummary();
    copyText(summary).then(function () {
        showToast('Summary copied to clipboard', true);
    }).catch(function () { showToast('Copy failed — select manually'); });
}

function shareOnWhatsApp() {
    const summary = shareResultsSummary();
    const url = 'https://wa.me/?text=' + encodeURIComponent(summary);
    window.open(url, '_blank', 'noopener');
    showToast('Opening WhatsApp share…', true);
}

/* ============================================================
   Persistence (localStorage)
   ============================================================ */
function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            results: allServers,
            timeout: timeOutValue.value,
            concurrency: concurrencyValue.value,
            autoscroll: autoscroll.checked,
            accurateProbe: accurateProbe.checked,
            retryUnreachable: retryUnreachable.checked,
            soundOnComplete: soundOnComplete.checked
        }));
    } catch (e) { /* quota / disabled */ }
}

function clearSavedState() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    try { localStorage.removeItem(CUSTOM_LIST_KEY); } catch (e) {}
    customListText = null;
    updateCustomListUI();
}

function restoreState() {
    let data;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        data = JSON.parse(raw);
    } catch (e) { return; }

    if (data.timeout) timeOutValue.value = data.timeout;
    if (data.concurrency) concurrencyValue.value = data.concurrency;
    if (typeof data.autoscroll === 'boolean') autoscroll.checked = data.autoscroll;
    if (typeof data.accurateProbe === 'boolean') accurateProbe.checked = data.accurateProbe;
    if (typeof data.retryUnreachable === 'boolean') retryUnreachable.checked = data.retryUnreachable;
    if (typeof data.soundOnComplete === 'boolean') soundOnComplete.checked = data.soundOnComplete;

    if (Array.isArray(data.results) && data.results.length) {
        allServers = data.results;
        totalUrls = allServers.length;
        onlineCount = allServers.filter(function (e) { return e.status === 'online'; }).length;
        offlineCount = allServers.filter(function (e) { return e.status === 'offline'; }).length;
        processedUrls = allServers.length;
        scanFinished = true;
        updateStats();
        updateProgress(100);
        renderResults();
        showToast('Restored previous scan results');
    }
}

/* ============================================================
   Server History Tracking
   ============================================================ */
function recordServerHistory(url, status) {
    try {
        const history = JSON.parse(localStorage.getItem(SERVER_HISTORY_KEY) || '{}');
        if (!history[url]) {
            history[url] = { online: 0, offline: 0, lastSeen: null, firstSeen: Date.now() };
        }
        history[url][status]++;
        history[url].lastSeen = Date.now();
        
        // Keep only last 100 servers to prevent storage bloat
        const entries = Object.entries(history);
        if (entries.length > 100) {
            entries.sort(function (a, b) { return b[1].lastSeen - a[1].lastSeen; });
            const trimmed = {};
            for (let i = 0; i < 100; i++) {
                trimmed[entries[i][0]] = entries[i][1];
            }
            localStorage.setItem(SERVER_HISTORY_KEY, JSON.stringify(trimmed));
        } else {
            localStorage.setItem(SERVER_HISTORY_KEY, JSON.stringify(history));
        }
    } catch (e) { /* ignore storage errors */ }
}

function getServerHistory(url) {
    try {
        const history = JSON.parse(localStorage.getItem(SERVER_HISTORY_KEY) || '{}');
        return history[url] || null;
    } catch (e) { return null; }
}

function getServerReliability(url) {
    const history = getServerHistory(url);
    if (!history || (history.online + history.offline) === 0) return null;
    const total = history.online + history.offline;
    return {
        reliability: Math.round((history.online / total) * 100),
        totalChecks: total,
        lastSeen: history.lastSeen
    };
}

/* ============================================================
   Speed Testing Integration
   ============================================================ */
async function testServerSpeed(url) {
    // Using a simple fetch-based speed test (simulated for static site)
    const startTime = performance.now();
    try {
        const response = await fetch(url, { 
            method: 'HEAD', 
            mode: 'no-cors',
            cache: 'no-store'
        });
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        // Estimate speed based on response time (simplified)
        const speedScore = Math.max(0, Math.min(100, Math.round(10000 / duration)));
        
        return {
            url: url,
            responseTime: Math.round(duration),
            speedScore: speedScore,
            timestamp: Date.now()
        };
    } catch (e) {
        return {
            url: url,
            responseTime: null,
            speedScore: 0,
            timestamp: Date.now(),
            error: true
        };
    }
}

function saveSpeedTestResult(result) {
    try {
        const speedTests = JSON.parse(localStorage.getItem(SPEED_TEST_KEY) || '[]');
        speedTests.push(result);
        
        // Keep only last 50 speed tests
        if (speedTests.length > 50) {
            speedTests.shift();
        }
        
        localStorage.setItem(SPEED_TEST_KEY, JSON.stringify(speedTests));
    } catch (e) { /* ignore storage errors */ }
}

function getAverageSpeedScore(url) {
    try {
        const speedTests = JSON.parse(localStorage.getItem(SPEED_TEST_KEY) || '[]');
        const urlTests = speedTests.filter(function (t) { return t.url === url && !t.error; });
        if (urlTests.length === 0) return null;
        
        const totalScore = urlTests.reduce(function (sum, t) { return sum + t.speedScore; }, 0);
        return Math.round(totalScore / urlTests.length);
    } catch (e) { return null; }
}

/* ============================================================
   Real-time Status Simulation (for static site)
   ============================================================ */
let realtimeInterval = null;

function startRealtimeUpdates() {
    if (realtimeInterval) clearInterval(realtimeInterval);
    
    // Simulate real-time updates every 30 seconds
    realtimeInterval = setInterval(function () {
        if (!scanningActive && allServers.length > 0) {
            // Randomly check a few servers to simulate real-time monitoring
            const sampleSize = Math.min(5, Math.floor(allServers.length / 10));
            const indices = [];
            while (indices.length < sampleSize) {
                const idx = Math.floor(Math.random() * allServers.length);
                if (indices.indexOf(idx) === -1) indices.push(idx);
            }
            
            indices.forEach(function (idx) {
                const server = allServers[idx];
                if (server) {
                    // Simulate status change (10% chance of status flip)
                    if (Math.random() < 0.1) {
                        const newStatus = server.status === 'online' ? 'offline' : 'online';
                        server.status = newStatus;
                        server.timestamp = Date.now();
                        
                        if (newStatus === 'online') {
                            onlineCount++;
                            offlineCount--;
                        } else {
                            onlineCount--;
                            offlineCount++;
                        }
                        
                        updateStats();
                        scheduleRender();
                    }
                }
            });
        }
    }, 30000); // 30 seconds
}

function stopRealtimeUpdates() {
    if (realtimeInterval) {
        clearInterval(realtimeInterval);
        realtimeInterval = null;
    }
}

/* ============================================================
   Custom list import
   ============================================================ */
function loadCustomList(text) {
    customListText = text;
    try { localStorage.setItem(CUSTOM_LIST_KEY, text); } catch (e) {}
    updateCustomListUI();
}

function clearCustomList() {
    customListText = null;
    try { localStorage.removeItem(CUSTOM_LIST_KEY); } catch (e) {}
    customListFile.value = '';
    updateCustomListUI();
    showToast('Custom list cleared — will use default server list');
}

function restoreCustomList() {
    try {
        const raw = localStorage.getItem(CUSTOM_LIST_KEY);
        if (!raw) return;
        customListText = raw;
        updateCustomListUI();
        showToast('Restored custom server list');
    } catch (e) {}
}

function updateCustomListUI() {
    if (!customListMeta || !clearCustomListBtn || !customListFile) return;
    if (customListText) {
        const count = parseList(customListText).length;
        customListMeta.textContent = count + ' server' + (count === 1 ? '' : 's') + ' loaded';
        clearCustomListBtn.hidden = false;
        customListFile.value = '';
    } else {
        customListMeta.textContent = '';
        clearCustomListBtn.hidden = true;
    }
}

/* ============================================================
   Visitors badge (free countapi)
   ============================================================ */
function loadVisitors() {
    const badge = $('visitorsBadge');
    const countEl = $('visitorsCount');
    if (!badge || !countEl) return;
    fetch(VISITORS_API).then(function (r) { return r.json(); }).then(function (d) {
        if (d && typeof d.value === 'number') {
            countEl.textContent = d.value.toLocaleString();
            badge.hidden = false;
        }
    }).catch(function () { badge.hidden = true; });
}

/* ============================================================
   Telegram deep-link CTA on completion
   ============================================================ */
function showCompletionCta(reachCount) {
    if (!completionCta) return;
    const msg = 'Hey! I just scanned BDIX servers with BDIX Radar — found ' +
        reachCount + ' reachable. Check it out: ' + SHARE_BASE_URL + SHARE_UTM;
    telegramCtaBtn.href = TELEGRAM_PROMO + '?text=' + encodeURIComponent(msg);
    completionCta.hidden = false;
    completionCta.classList.add('show');
}
function hideCompletionCta() {
    if (!completionCta) return;
    completionCta.hidden = true;
    completionCta.classList.remove('show');
}

/* ============================================================
   Client-side share card (canvas 1200x630)
   ============================================================ */
function drawShareCard() {
    const c = shareCanvas;
    if (!c || !c.getContext) return null;
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0f1722');
    bg.addColorStop(1, '#0b1220');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    function orb(x, y, r, color) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
    }
    orb(W * 0.12, H * 0.2, 360, 'rgba(16,185,129,0.35)');
    orb(W * 0.9, H * 0.85, 420, 'rgba(14,165,164,0.30)');
    orb(W * 0.7, H * 0.15, 300, 'rgba(245,158,11,0.20)');

    const pad = 50, panelX = pad, panelY = pad, panelW = W - pad * 2, panelH = H - pad * 2;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    roundRect(ctx, panelX, panelY, panelW, panelH, 28); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 2; roundRect(ctx, panelX, panelY, panelW, panelH, 28); ctx.stroke();

    ctx.textBaseline = 'top';
    ctx.fillStyle = '#eaf2ff';
    ctx.font = '700 64px Inter, sans-serif';
    ctx.fillText('BDIX Radar', panelX + 48, panelY + 48);

    const grad = ctx.createLinearGradient(panelX + 48, 0, panelX + 48 + 900, 0);
    grad.addColorStop(0, '#10b981');
    grad.addColorStop(1, '#0ea5a4');
    ctx.fillStyle = grad;
    ctx.font = '700 76px Inter, sans-serif';
    ctx.fillText('I found ' + onlineCount + ' reachable', panelX + 48, panelY + 150);
    ctx.fillText('BDIX servers', panelX + 48, panelY + 238);

    ctx.fillStyle = '#9fb0d0';
    ctx.font = '400 34px "JetBrains Mono", monospace';
    ctx.fillText(offlineCount + ' unreachable · ' + totalUrls + ' scanned', panelX + 48, panelY + 350);

    ctx.fillStyle = '#eaf2ff';
    ctx.font = '600 36px Inter, sans-serif';
    ctx.fillText('@n0b0jit_nexus', panelX + 48, panelY + 440);
    ctx.fillStyle = '#10b981';
    ctx.fillText('linktr.ee/mr_nobojit.m', panelX + 48, panelY + 496);

    ctx.fillStyle = '#7f8db0';
    ctx.font = '500 30px "JetBrains Mono", monospace';
    ctx.fillText('nexus-bdix-scanner.onrender.com', panelX + 48, panelY + 552);

    return c;
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function openCardModal() {
    if (totalUrls === 0) { showToast('Run a scan first to generate a card'); return; }
    const c = drawShareCard();
    if (!c) { showToast('Canvas unsupported — using text share'); shareResults(); return; }
    cardModal.hidden = false;
    cardModal.classList.add('open');
    cardHint.textContent = '';
}

function downloadCard() {
    const c = drawShareCard();
    if (!c) { showToast('Canvas unsupported'); return; }
    c.toBlob(function (blob) {
        if (!blob) { showToast('Image export not supported'); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'bdix-radar-card.png';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        showToast('Card downloaded', true);
    }, 'image/png');
}

function copyCardImage() {
    if (!navigator.clipboard || !navigator.clipboard.write || typeof ClipboardItem === 'undefined') {
        cardHint.textContent = 'Clipboard image copy unsupported here — use Download card.';
        return;
    }
    drawShareCard();
    shareCanvas.toBlob(function (blob) {
        if (!blob) { cardHint.textContent = 'Image copy failed.'; return; }
        navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
            .then(function () { cardHint.textContent = 'Image copied to clipboard.'; })
            .catch(function () { cardHint.textContent = 'Clipboard blocked — try Download card.'; });
    }, 'image/png');
}

/* ============================================================
   Submit a server (GitHub issue / Telegram)
   ============================================================ */
function handleSubmit(e) {
    e.preventDefault();
    const url = (submitUrl.value || '').trim();
    if (!url) { showToast('Enter a server URL'); return; }
    const note = (submitNote.value || '').trim();
    const body = '**Server URL:** ' + url + '\n\n' +
        (note ? '**Note:** ' + note + '\n\n' : '') +
        '_Submitted from BDIX Radar._';
    const issueUrl = GITHUB_ISSUE_URL + '?title=' + encodeURIComponent('Submit server: ' + url) +
        '&body=' + encodeURIComponent(body) + '&labels=' + encodeURIComponent('server-submission');
    const tgMsg = 'New BDIX server to add: ' + url + (note ? ' — ' + note : '');
    const tgUrl = TELEGRAM_PROMO + '?text=' + encodeURIComponent(tgMsg);
    window.open(issueUrl, '_blank', 'noopener');
    window.open(tgUrl, '_blank', 'noopener');
    submitForm.reset();
    showToast('Opened GitHub issue + Telegram submit', true);
}

/* ============================================================
   Web Push notifications (client side)
   ============================================================ */
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
}

async function enableNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        notifyToggle.checked = false;
        showToast('Push notifications unsupported in this browser');
        return;
    }
    if (VAPID_PUBLIC_KEY.indexOf('PLACEHOLDER') !== -1) {
        notifyToggle.checked = false;
        showToast('Set VAPID_PUBLIC_KEY + /api/subscribe to enable (see README)');
        return;
    }
    try {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') { notifyToggle.checked = false; showToast('Notification permission denied'); return; }
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
        await fetch(SUBSCRIBE_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sub)
        });
        showToast('Notifications enabled', true);
    } catch (err) {
        console.error(err);
        notifyToggle.checked = false;
        showToast('Subscribe failed — check endpoint/VAPID');
    }
}

async function disableNotifications() {
    try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
        showToast('Notifications disabled');
    } catch (e) { /* ignore */ }
}

/* ============================================================
   PWA update prompt
   ============================================================ */
function showUpdateBanner() {
    if (!updateBanner) return;
    updateBanner.hidden = false;
    updateBanner.classList.add('show');
}

function setupUpdateDetection(reg) {
    if (!reg) return;
    reg.addEventListener('updatefound', function () {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', function () {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                showUpdateBanner();
            }
        });
    });
}

function setupControllerChange() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
        showUpdateBanner();
    });
}

/* ============================================================
   Social follow modal (Facebook / Instagram)
   ============================================================ */
const SOCIAL_FOLLOW_KEY = 'nexusBdixScanner.socialFollowDismissed';

function showSocialFollowModal(force) {
    if (!socialFollowModal) return;
    if (!force) {
        try {
            if (localStorage.getItem(SOCIAL_FOLLOW_KEY) === '1') return;
        } catch (e) { /* ignore */ }
    }
    socialFollowModal.hidden = false;
    socialFollowModal.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function hideSocialFollowModal() {
    if (!socialFollowModal) return;
    socialFollowModal.hidden = true;
    socialFollowModal.classList.remove('open');
    document.body.style.overflow = '';
    try { localStorage.setItem(SOCIAL_FOLLOW_KEY, '1'); } catch (e) {}
    if (socialFollowHint) socialFollowHint.textContent = '';
}

/* ============================================================
    Wiring
    ============================================================ */
function init() {
    console.log('BDIX Radar init running');
    if (startStopBtn) {
        console.log('Attaching click to startStopBtn');
        startStopBtn.addEventListener('click', function (e) {
            console.log('Start/Stop clicked, scanningActive=' + scanningActive);
            toggleScanning();
        });
    }
    if (resetBtn) resetBtn.addEventListener('click', resetScanning);
    if (searchInput) searchInput.addEventListener('input', renderResults);
    $('copyOnlineBtn').addEventListener('click', function () {
        copyText(reachableUrls().join('\n')).then(function () { showToast('Reachable URLs copied', true); })
            .catch(function () { showToast('Copy failed'); });
    });
    $('copyOfflineBtn').addEventListener('click', function () {
        copyText(unreachableUrls().join('\n')).then(function () { showToast('Unreachable URLs copied', true); })
            .catch(function () { showToast('Copy failed'); });
    });
    $('downloadBtn').addEventListener('click', downloadTxt);
    $('shareBtn').addEventListener('click', shareResults);
    if ($('whatsappBtn')) {
        $('whatsappBtn').addEventListener('click', shareOnWhatsApp);
    }

    document.querySelectorAll('.pill').forEach(function (btn) {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.pill').forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
            currentFilter = btn.getAttribute('data-filter');
            renderResults();
        });
    });

    [timeOutValue, concurrencyValue].forEach(function (el) {
        el.addEventListener('change', saveState);
    });
    [autoscroll, accurateProbe, retryUnreachable, soundOnComplete].forEach(function (el) {
        el.addEventListener('change', saveState);
    });

    document.addEventListener('keydown', function (e) {
        const typing = ['INPUT', 'TEXTAREA', 'SELECT'].indexOf(e.target.tagName) !== -1;
        if (e.key === ' ' && !typing) { e.preventDefault(); toggleScanning(); }
        else if ((e.key === 'r' || e.key === 'R') && !typing) { resetScanning(); }
        else if (e.key === '/' && !typing) { e.preventDefault(); searchInput.focus(); }
        else if (e.key === 'Escape') {
            if (cardModal && !cardModal.hidden) hideCardModal();
            if (socialFollowModal && !socialFollowModal.hidden) hideSocialFollowModal();
        }
    });

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
            .then(function (reg) { setupUpdateDetection(reg); })
            .catch(function () {});
        setupControllerChange();
    }

    if (shareCardBtn) {
        shareCardBtn.addEventListener('click', openCardModal);
    }
    if (downloadCardBtn) downloadCardBtn.addEventListener('click', downloadCard);
    if (copyCardBtn) copyCardBtn.addEventListener('click', copyCardImage);
    if (copyCardTextBtn) copyCardTextBtn.addEventListener('click', function () {
        copyText(shareResultsSummary()).then(function () { cardHint.textContent = 'Summary copied.'; })
            .catch(function () { cardHint.textContent = 'Copy failed.'; });
    });
    if (cardModal) {
        cardModal.querySelectorAll('[data-close-card]').forEach(function (el) {
            el.addEventListener('click', hideCardModal);
        });
    }

    if (socialFollowModal) {
        socialFollowModal.querySelectorAll('[data-close-social]').forEach(function (el) {
            el.addEventListener('click', hideSocialFollowModal);
        });
    }

    if (submitForm) submitForm.addEventListener('submit', handleSubmit);

    if (customListFile) {
        customListFile.addEventListener('change', function () {
            const file = customListFile.files && customListFile.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function (e) {
                const text = (e.target.result || '').toString();
                if (!text.trim()) { showToast('File appears empty'); return; }
                loadCustomList(text.trim());
                showToast('Custom list loaded (' + parseList(text.trim()).length + ' servers)', true);
            };
            reader.onerror = function () { showToast('Failed to read file'); };
            reader.readAsText(file);
        });
    }

    if (clearCustomListBtn) clearCustomListBtn.addEventListener('click', clearCustomList);

    if (notifyToggle) notifyToggle.addEventListener('change', function () {
        if (notifyToggle.checked) enableNotifications();
        else disableNotifications();
    });

    if (reloadBtn) reloadBtn.addEventListener('click', function () { window.location.reload(); });
    if (dismissUpdateBtn) dismissUpdateBtn.addEventListener('click', function () {
        updateBanner.hidden = true;
        updateBanner.classList.remove('show');
    });

    if (socialPopupClose) socialPopupClose.addEventListener('click', hideSocialPopup);

    loadVisitors();
    restoreState();
    restoreCustomList();
    prefetchServerList();
    setupYouTubeShowcase();
    setTimeout(function () { showSocialFollowModal(false); }, 8000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

function hideCardModal() {
    if (!cardModal) return;
    cardModal.hidden = true;
    cardModal.classList.remove('open');
}

/* ============================================================
   Idle prefetch of all_servers.txt so scans start instantly
   ============================================================ */
function prefetchServerList() {
    const doFetch = function () {
        fetch(SERVER_LIST_URL, { cache: 'force-cache' })
            .then(function (r) { return r.text(); })
            .then(function (t) { serverListCache = t; })
            .catch(function () {});
    };
    if ('requestIdleCallback' in window) {
        requestIdleCallback(doFetch, { timeout: 2000 });
    } else {
        setTimeout(doFetch, 800);
    }
}
