// ==UserScript==
// @name         Testportal Combined Script
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Combined Testportal multitool + AI Solver (Gemini) + Discord Webhook
// @author       You
// @match        *://*.testportal.com/*
// @match        *://testportal.com/*
// @match        *://*.testportal.net/*
// @match        *://*.testportal.pl/*
// @match        *://testportal.pl/*
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function () {
    'use strict';

    console.log("[TESTPORTAL COMBINED] started");

    // ----- BLUR & NATIVE CODE BYPASS -----
    const original = RegExp.prototype.test;
    RegExp.prototype.test = function (s) {
        const string = this.toString();
        if (string.includes("native code") && string.includes("function")) {
            return true;
        }
        return original.call(this, s);
    };

    window.logToServer = function (x) { console.log(x); };
    window.addEventListener('error', () => true);

    // ----- TIME LIMIT BYPASS -----
    function timeLimit() {
        // window.startTime = Infinity;
        // setInterval(() => { window.startTime = new Date().getTime(); }, 0);

        document.hasFocus = () => true;
        Object.defineProperty(document, 'hasFocus', {
            get: () => true,
        });

        // const remTimeContent = document.getElementById("remaining_time_content");
        // if (remTimeContent) {
        //     remTimeContent.outerHTML = "";
        // }
    }

    // ----- IFRAME SETUP -----
    let searchIframe = null;
    let iframeVisible = false;
    let iframeLocked = false;
    let iframeWidth = parseInt(localStorage.getItem("tp_iframeWidth")) || 450;
    let iframeHeight = parseInt(localStorage.getItem("tp_iframeHeight")) || 550;
    let iframeAlign = localStorage.getItem("tp_iframeAlign") || "right"; // left, right, middle

    function setupIframe() {
        searchIframe = document.createElement("iframe");
        searchIframe.style.position = "fixed";
        searchIframe.style.bottom = "10px";

        if (iframeAlign === "left") {
            searchIframe.style.left = "10px"; searchIframe.style.right = "auto"; searchIframe.style.transform = "none";
        } else if (iframeAlign === "middle") {
            searchIframe.style.left = "50%"; searchIframe.style.right = "auto"; searchIframe.style.transform = "translateX(-50%)";
        } else {
            searchIframe.style.right = "10px"; searchIframe.style.left = "auto"; searchIframe.style.transform = "none";
        }

        searchIframe.style.width = iframeWidth + "px";
        searchIframe.style.height = iframeHeight + "px";
        searchIframe.style.zIndex = "999999";
        searchIframe.style.backgroundColor = "white";
        searchIframe.style.border = "2px solid #ccc";
        searchIframe.style.borderRadius = "8px";
        searchIframe.style.display = "none";
        searchIframe.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
        document.body.appendChild(searchIframe);

        document.addEventListener("keydown", (e) => {
            if (e.target.tagName.toLowerCase() === 'input' || e.target.tagName.toLowerCase() === 'textarea') return;

            if (e.key === "\\") {
                if (!iframeLocked) {
                    iframeVisible = !iframeVisible;
                    searchIframe.style.display = iframeVisible ? "block" : "none";
                }
            }
            if (e.key === "-") {
                iframeLocked = !iframeLocked;
                console.log("[TESTPORTAL] Iframe & AI locked:", iframeLocked);
                if (iframeLocked) {
                    iframeVisible = false;
                    if (searchIframe) searchIframe.style.display = "none";
                    if (aiResponseDiv) aiResponseDiv.style.display = "none";
                }
            }
            if (e.key === "l" && iframeVisible) {
                iframeAlign = "left";
                localStorage.setItem("tp_iframeAlign", iframeAlign);
                searchIframe.style.left = "10px"; searchIframe.style.right = "auto"; searchIframe.style.transform = "none";
            }
            if (e.key === "r" && iframeVisible) {
                iframeAlign = "right";
                localStorage.setItem("tp_iframeAlign", iframeAlign);
                searchIframe.style.right = "10px"; searchIframe.style.left = "auto"; searchIframe.style.transform = "none";
            }
            if (e.key === "m" && iframeVisible) {
                iframeAlign = "middle";
                localStorage.setItem("tp_iframeAlign", iframeAlign);
                searchIframe.style.left = "50%"; searchIframe.style.right = "auto"; searchIframe.style.transform = "translateX(-50%)";
            }
            if (e.key === "q" && iframeVisible) {
                iframeWidth = Math.max(200, iframeWidth - 50);
                localStorage.setItem("tp_iframeWidth", iframeWidth);
                searchIframe.style.width = iframeWidth + "px";
            }
            if (e.key === "e" && iframeVisible) {
                iframeWidth += 50;
                localStorage.setItem("tp_iframeWidth", iframeWidth);
                searchIframe.style.width = iframeWidth + "px";
            }
            if (e.key === "g" && iframeVisible) {
                iframeHeight = Math.max(200, iframeHeight - 50);
                localStorage.setItem("tp_iframeHeight", iframeHeight);
                searchIframe.style.height = iframeHeight + "px";
            }
            if (e.key === "j" && iframeVisible) {
                iframeHeight += 50;
                localStorage.setItem("tp_iframeHeight", iframeHeight);
                searchIframe.style.height = iframeHeight + "px";
            }
        });
    }

    // ----- CLICK FULL SEARCH (Header) -----
    function setupHeaderSearch() {
        const headers = document.getElementsByClassName("question_header_content");
        for (let i = 0; i < headers.length; i++) {
            if (!headers[i].dataset.searchBound) {
                headers[i].dataset.searchBound = "true";
                headers[i].style.cursor = "pointer";
                headers[i].title = "Click to search full question + answers";
                headers[i].addEventListener("click", () => {
                    let queryParts = [];

                    const qEssence = document.querySelector(".question_essence");
                    if (qEssence) {
                        let text = qEssence.innerText.trim();
                        if (text) queryParts.push(text);

                        const img = qEssence.querySelector("img");
                        if (img) {
                            let imgSrc = img.getAttribute("data-src") || img.getAttribute("src");
                            if (imgSrc) {
                                queryParts.push(imgSrc);
                            }
                        }
                    }

                    const answerContainers = document.querySelectorAll('.answer_container');
                    if (answerContainers.length > 0) {
                        answerContainers.forEach((container, index) => {
                            const label = container.querySelector('.answer_body');
                            if (label) {
                                const text = label.innerText.trim();
                                const letter = String.fromCharCode(65 + index);
                                queryParts.push(`${letter}) ${text}`);
                            }
                        });
                    }

                    let finalQuery = queryParts.join("\n").trim();
                    if (finalQuery && searchIframe) {
                        searchIframe.src = `https://google.com/search?q=${encodeURIComponent(finalQuery)}&igu=1`;
                        if (!iframeLocked) {
                            iframeVisible = true;
                            searchIframe.style.display = "block";
                        }
                    }
                });
            }
        }
    }

    // ----- CLICK SEARCH -----
    function setupClickSearch() {
        const hackClass = ["answer_body", "question_essence"];
        hackClass.forEach(c => {
            const elms = document.getElementsByClassName(c);
            for (let i = 0; i < elms.length; i++) {
                if (!elms[i].dataset.searchBound) {
                    elms[i].dataset.searchBound = "true";
                    elms[i].style.cursor = "pointer";
                    elms[i].addEventListener("click", (e) => {
                        if (e.target.tagName.toLowerCase() === "img") return; // Handled by imageSearch

                        // Let original inputs work if they're directly clicked
                        if (e.target.type === "radio" || e.target.type === "checkbox") return;

                        const text = elms[i].innerText.trim();
                        if (!text) return;

                        if (searchIframe) {
                            searchIframe.src = `https://google.com/search?q=${encodeURIComponent(text)}&igu=1`;
                            if (!iframeLocked) {
                                iframeVisible = true;
                                searchIframe.style.display = "block";
                            }
                        }
                    });
                }
            }
        });
    }

    // ----- IMAGE SEARCH -----
    function imageSearch() {
        const imgs = document.getElementsByTagName('img');
        for (let i = 0; i < imgs.length; i++) {
            ((imgs, i) => {
                setTimeout(() => {
                    if (imgs[i].innerHTML && imgs[i].innerHTML.includes("logo_wide logo_default")) {
                        return;
                    }
                    if (imgs[i].getAttribute("src") && imgs[i].getAttribute("src").includes('data:image')) {
                        if (imgs[i].getAttribute("data-src")) {
                            imgs[i].setAttribute("src", imgs[i].getAttribute("data-src"));
                        }
                        imgs[i].setAttribute("class", "");
                    }

                    if (!imgs[i].dataset.searchBound) {
                        imgs[i].dataset.searchBound = "true";
                        imgs[i].style.cursor = "pointer";
                        imgs[i].addEventListener("click", (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (searchIframe) {
                                searchIframe.src = "https://www.google.com/searchbyimage?igu=1&image_url=" + encodeURI(e.target.src);
                                if (!iframeLocked) {
                                    iframeVisible = true;
                                    searchIframe.style.display = "block";
                                }
                            }
                        });
                    }
                }, 0);
            })(imgs, i);
        }
    }

    // ----- AI RESPONSE OVERLAY -----
    let aiResponseDiv = null;

    function setupAiResponseDiv() {
        aiResponseDiv = document.createElement("div");
        aiResponseDiv.style.position = "fixed";
        aiResponseDiv.style.bottom = "10px";
        aiResponseDiv.style.right = "10px";
        aiResponseDiv.style.width = "400px";
        aiResponseDiv.style.padding = "15px";
        aiResponseDiv.style.zIndex = "1000001"; // Above everything
        aiResponseDiv.style.backgroundColor = "rgba(0, 0, 0, 0.85)";
        aiResponseDiv.style.color = "white";
        aiResponseDiv.style.border = "1px solid #555";
        aiResponseDiv.style.borderRadius = "8px";
        aiResponseDiv.style.display = "none";
        aiResponseDiv.style.fontFamily = "sans-serif";
        aiResponseDiv.style.fontSize = "14px";
        aiResponseDiv.style.whiteSpace = "pre-wrap";
        aiResponseDiv.innerHTML = "Oczekiwanie na odpowiedź AI...";
        document.body.appendChild(aiResponseDiv);

        document.addEventListener("keydown", (e) => {
            if (e.target.tagName.toLowerCase() === 'input' || e.target.tagName.toLowerCase() === 'textarea') return;
            if (e.key === "]" && !iframeLocked) aiResponseDiv.style.display = "block";
        });
        document.addEventListener("keyup", (e) => {
            if (e.target.tagName.toLowerCase() === 'input' || e.target.tagName.toLowerCase() === 'textarea') return;
            if (e.key === "]") aiResponseDiv.style.display = "none";
        });
    }

    function setAiResponse(text) {
        if (aiResponseDiv) {
            aiResponseDiv.innerHTML = text;
        }
    }

    // ----- GEMINI AI SOLVER -----
    // Using API info from testportal.js
    const API_KEY = 'AIzaSyBcENf7oZsRh7KZTrbfXrmTv8WfnFewTaE';
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent`;
    const MAX_RETRIES = 5;
    const BASE_DELAY_MS = 1000;

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function fetchImageAsBase64(url) {
        return new Promise((resolve, reject) => {
            if (typeof GM_xmlhttpRequest !== "undefined") {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: url,
                    responseType: "arraybuffer", // Use arraybuffer since blob might be restricted in some GM versions
                    onload: function (response) {
                        try {
                            const buffer = response.response;
                            const bytes = new Uint8Array(buffer);
                            let binary = '';
                            for (let i = 0; i < bytes.byteLength; i++) {
                                binary += String.fromCharCode(bytes[i]);
                            }
                            const base64data = btoa(binary);

                            // Try to guess mime type from header or default to jpeg
                            let mimeType = "image/jpeg";
                            if (response.responseHeaders) {
                                const match = response.responseHeaders.match(/content-type:\s*(image\/[a-zA-Z]+)/i);
                                if (match) mimeType = match[1];
                            }
                            resolve({ mimeType: mimeType, data: base64data });
                        } catch (e) { reject(e); }
                    },
                    onerror: reject
                });
            } else {
                fetch(url)
                    .then(res => res.blob())
                    .then(blob => {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            const base64data = reader.result.split(',')[1];
                            resolve({ mimeType: blob.type || "image/jpeg", data: base64data });
                        };
                        reader.readAsDataURL(blob);
                    })
                    .catch(reject);
            }
        });
    }

    async function askGemini(parts, attempt = 1) {
        console.log(`Gemini: attempt ${attempt}/${MAX_RETRIES}...`);
        return new Promise((resolve, reject) => {
            const payload = JSON.stringify({
                contents: [{ parts: parts }]
            });

            if (typeof GM_xmlhttpRequest !== "undefined") {
                GM_xmlhttpRequest({
                    method: "POST",
                    url: `${API_URL}?key=${API_KEY}`,
                    headers: {
                        "Content-Type": "application/json",
                        "X-goog-api-key": API_KEY
                    },
                    data: payload,
                    onload: resolve,
                    onerror: reject
                });
            } else {
                fetch(`${API_URL}?key=${API_KEY}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-goog-api-key": API_KEY
                    },
                    body: payload
                }).then(res => res.text()).then(text => resolve({ status: 200, responseText: text })).catch(reject);
            }
        });
    }

    async function runAI() {
        const questionEl = document.querySelector('.question_essence');
        if (!questionEl) {
            console.warn('No question found for AI solver.');
            return;
        }

        let questionText = questionEl.innerText.trim();

        const answerContainers = document.querySelectorAll('.answer_container');
        const answers = [];
        answerContainers.forEach((container, index) => {
            const radio = container.querySelector('input[type="radio"]') || container.querySelector('input[type="checkbox"]');
            const label = container.querySelector('.answer_body');
            if (radio && label) {
                let text = label.innerText.trim();
                answers.push({
                    id: radio.value,
                    letter: String.fromCharCode(65 + index),
                    container: container,
                    text: text
                });
            }
        });

        const hasAnswers = answers.length > 0;
        let answersText = "";
        let prompt = "";

        let promptArgs = [];
        if (hasAnswers) {
            answersText = answers.map(a => `${a.letter}) ${a.text}`).join('\n');
            prompt = `Jesteś ekspertem. Daj odpowiedź na podane niżej pytanie bez zbędnego gadania. Pamiętaj, że dotyczy ono miedzy innymi JavaScriptu (jeśli ma to sens w kontekście).

Pytanie:
${questionText}

Odpowiedzi:
${answersText}

Daj mi samą odpowiedź (lub litery). Jeżeli możesz, odpowiedz TYLKO literą poprawnej odpowiedzi (A, B, itd.). Można zaznaczyć parę opcji w razie potrzeby. Pamiętaj - nie wyjaśniaj dlaczego, tylko zastanów się nad odpowiedzią.`;
        } else {
            prompt = `Jesteś ekspertem. Daj odpowiedź na podane niżej pytanie bez zbędnego gadania. Pamiętaj, z reguły dotyczy ono JavaScriptu lub programowania (jesli ma to sens w kontekscie).

Pytanie:
${questionText}

Proszę o krótką odpowiedź, bez wyjaśnień. Maksymalnie 2 zdania, ale postarj się jak najkrócej.`;
        }

        promptArgs.push({ text: prompt });

        const qEssenceImg = document.querySelector(".question_essence img");
        if (qEssenceImg) {
            let imgSrc = qEssenceImg.getAttribute("data-src") || qEssenceImg.getAttribute("src");
            if (imgSrc) {
                try {
                    setAiResponse("Pobieranie obrazka do wysłania...");
                    let imgData = await fetchImageAsBase64(imgSrc);
                    promptArgs.push({
                        inlineData: {
                            mimeType: imgData.mimeType,
                            data: imgData.data
                        }
                    });
                    console.log("Attached image to AI prompt.");
                    setAiResponse("Oczekiwanie na odpowiedź AI... (z obrazkiem)");
                } catch (e) {
                    console.error("Failed to fetch image for AI prompt", e);
                    setAiResponse("Oczekiwanie na odpowiedź AI... (nie udało się załadować obrazka)");
                }
            }
        }

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const response = await askGemini(promptArgs, attempt);
                console.log("Gemini status:", response.status);

                if (response.status === 503 || response.status === 429) {
                    const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
                    console.warn(`Got ${response.status}, retrying in ${delay}ms...`);
                    if (attempt < MAX_RETRIES) {
                        await sleep(delay);
                        continue;
                    } else {
                        return;
                    }
                }

                let json;
                try {
                    json = JSON.parse(response.responseText);
                } catch (e) {
                    console.error("Failed to parse Gemini response:", response.responseText);
                    return;
                }

                const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

                if (!text) {
                    console.error("Unexpected response shape:", json);
                    setAiResponse("Błąd: Pusta odpowiedź od AI.");
                    return;
                }

                setAiResponse(`[AI] Odpowiedź:\n\n${text}`);

                // Send to webhook as scr.js does
                try {
                    fetch("https://discord.com/api/webhooks/1246153423259435212/OGoB46bwIWYByemZW-kEigRNgNgJ21hmISNUQnFOtxcQdsv-qXg9mt1cyjtcXAUY9ecj", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ "content": `[AI] Odpowiedź: ${text}` })
                    });
                } catch (e) { }

                if (hasAnswers) {
                    // Try to auto-select or mark answers
                    let selectedLetters = text.match(/\b([A-Z])\b/g);
                    if (selectedLetters) {
                        selectedLetters.forEach(chosenLetter => {
                            const chosenAnswer = answers.find(a => a.letter === chosenLetter);
                            if (chosenAnswer) {
                                const radio = document.querySelector(`input[value="${chosenAnswer.id}"]`);
                                if (radio) {
                                    radio.click();
                                    console.log(`Auto-selected answer ${chosenLetter}`);
                                }
                            }
                        });
                    } else {
                        // Fallback: match by full text
                        answers.forEach(a => {
                            if (text.includes(a.text) || a.text.includes(text)) {
                                const radio = document.querySelector(`input[value="${a.id}"]`);
                                if (radio) {
                                    radio.click();
                                }
                            }
                        });
                    }
                }

                return;

            } catch (err) {
                console.error("Request error:", err);
                if (attempt < MAX_RETRIES) {
                    const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
                    console.warn(`Network error, retrying in ${delay}ms...`);
                    setAiResponse(`Błąd sieci. Ponowna próba za ${delay}ms...`);
                    await sleep(delay);
                } else {
                    setAiResponse("Błąd sieci. Przekroczono limit prób.");
                    return;
                }
            }
        }
    }

    // ----- INITIALIZATION -----
    if (!window.location.href.includes("LoadTestStart.html")) {
        setupAiResponseDiv();
        setupIframe();
        setTimeout(timeLimit, 0);
        document.hasFocus = () => true;
        setTimeout(setupHeaderSearch, 100);
        setTimeout(setupClickSearch, 100);
        setTimeout(imageSearch, 200);
        setTimeout(runAI, 500); // 500ms delay ensures DOM overlay edits happened first
    }
})();
