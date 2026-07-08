// script.js
let allWords = [];
let quizWords = [];
let wrongWords = [];
let currentIdx = 0;
let score = 0;
let currentTargetSynonyms = [];
let isSubmitted = false;
let currentTestMode = "synonym"; 
let currentTestTypeLabel = "동의어 철자";
let currentTestDays = "";

let timerInterval = null;
let totalSeconds = 0;
let quizReviewData = [];

// 불규칙 동사 하드코딩 (미니 사전)
const irregularVerbs = {
    "arise": ["arose", "arisen"], "awake": ["awoke", "awoken"], "be": ["is", "am", "are", "was", "were", "been", "being"], "bear": ["bore", "born", "borne"], "beat": ["beat", "beaten"], "become": ["became", "become"], "begin": ["began", "begun"], "bend": ["bent", "bent"], "bet": ["bet", "bet"], "bind": ["bound", "bound"], "bite": ["bit", "bitten"], "bleed": ["bled", "bled"], "blow": ["blew", "blown"], "break": ["broke", "broken"], "bring": ["brought", "brought"], "build": ["built", "built"], "burn": ["burnt", "burned"], "burst": ["burst", "burst"], "buy": ["bought", "bought"], "catch": ["caught", "caught"], "choose": ["chose", "chosen"], "come": ["came", "come"], "cost": ["cost", "cost"], "creep": ["crept", "crept"], "cut": ["cut", "cut"], "deal": ["dealt", "dealt"], "dig": ["dug", "dug"], "do": ["did", "done"], "draw": ["drew", "drawn"], "drink": ["drank", "drunk"], "drive": ["drove", "driven"], "eat": ["ate", "eaten"], "fall": ["fell", "fallen"], "feed": ["fed", "fed"], "feel": ["felt", "felt"], "fight": ["fought", "fought"], "find": ["found", "found"], "flee": ["fled", "fled"], "fly": ["flew", "flown"], "forbid": ["forbade", "forbidden"], "forget": ["forgot", "forgotten"], "forgive": ["forgave", "forgiven"], "freeze": ["froze", "frozen"], "get": ["got", "gotten"], "give": ["gave", "given"], "go": ["went", "gone"], "grow": ["grew", "grown"], "hang": ["hung", "hung"], "have": ["had", "had", "has"], "hear": ["heard", "heard"], "hide": ["hid", "hidden"], "hit": ["hit", "hit"], "hold": ["held", "held"], "hurt": ["hurt", "hurt"], "keep": ["kept", "kept"], "know": ["knew", "known"], "lay": ["laid", "laid"], "lead": ["led", "led"], "leave": ["left", "left"], "lend": ["lent", "lent"], "let": ["let", "let"], "lie": ["lay", "lain"], "light": ["lit", "lit"], "lose": ["lost", "lost"], "make": ["made", "made"], "mean": ["meant", "meant"], "meet": ["met", "met"], "pay": ["paid", "paid"], "put": ["put", "put"], "read": ["read", "read"], "ride": ["rode", "ridden"], "ring": ["rang", "rung"], "rise": ["rose", "risen"], "run": ["ran", "run"], "say": ["said", "said"], "see": ["saw", "seen"], "seek": ["sought", "sought"], "sell": ["sold", "sold"], "send": ["sent", "sent"], "set": ["set", "set"], "shake": ["shook", "shaken"], "shine": ["shone", "shone"], "shoot": ["shot", "shot"], "show": ["showed", "shown"], "shut": ["shut", "shut"], "sing": ["sang", "sung"], "sink": ["sank", "sunk"], "sit": ["sat", "sat"], "sleep": ["slept", "slept"], "slide": ["slid", "slid"], "speak": ["spoke", "spoken"], "spend": ["spent", "spent"], "spin": ["spun", "spun"], "split": ["split", "split"], "spread": ["spread", "spread"], "spring": ["sprang", "sprung"], "stand": ["stood", "stood"], "steal": ["stole", "stolen"], "stick": ["stuck", "stuck"], "sting": ["stung", "stung"], "stink": ["stank", "stunk"], "strike": ["struck", "struck"], "swear": ["swore", "sworn"], "sweep": ["swept", "swept"], "swim": ["swam", "swum"], "swing": ["swung", "swung"], "take": ["took", "taken"], "teach": ["taught", "taught"], "tear": ["tore", "torn"], "tell": ["told", "told"], "think": ["thought", "thought"], "throw": ["threw", "thrown"], "understand": ["understood", "understood"], "wake": ["woke", "woken"], "wear": ["wore", "worn"], "win": ["won", "won"], "write": ["wrote", "written"]
};

function parseCSV(text) {
    if (text.startsWith('\uFEFF')) {
        text = text.substring(1);
    }
    const lines = text.split(/\r?\n/);
    const result = [];
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        let parts = [];
        let insideQuote = false;
        let currentPart = '';
        
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
                insideQuote = !insideQuote;
            } else if (char === ',' && !insideQuote) {
                parts.push(currentPart.trim());
                currentPart = '';
            } else {
                currentPart += char;
            }
        }
        parts.push(currentPart.trim());
        parts = parts.map(item => item.replace(/^"|"$/g, '').trim());

        if (parts.length >= 3) {
            const rawSyns = [parts[3], parts[4], parts[5], parts[6]];
            const validSyns = rawSyns.map(s => s ? s.trim() : "").filter(Boolean);

            result.push({
                day: parts[0],
                word: parts[1],
                pos: parts[2],
                synonyms: validSyns,
                meaning: parts[7] || '',
                example: parts[8] || '',
                exampleMeaning: parts[9] || ''
            });
        }
    }
    return result;
}

fetch('data.csv')
    .then(res => { if (!res.ok) throw new Error(); return res.arrayBuffer(); })
    .then(buffer => {
        const decoder = new TextDecoder('euc-kr');
        let text = decoder.decode(buffer);
        if (text.includes('')) {
            const utf8Decoder = new TextDecoder('utf-8');
            text = utf8Decoder.decode(buffer);
        }
        allWords = parseCSV(text); 
        checkWrongHistory(); 
    })
    .catch(() => alert('data.csv 파일을 불러오지 못했습니다.'));

function checkWrongHistory() {
    try {
        const saved = localStorage.getItem('wrongWords');
        if (saved) {
            wrongWords = JSON.parse(saved);
            const retryBtn = document.getElementById('retry-btn');
            if (retryBtn) {
                if (wrongWords.length > 0) retryBtn.classList.remove('hidden');
                else retryBtn.classList.add('hidden');
            }
        }
    } catch (e) {}
}

function startTimer() {
    stopTimer();
    totalSeconds = 0;
    const display = document.getElementById('timer-display');
    if (display) {
        display.innerText = "00:00";
        display.classList.remove('hidden');
    }
    timerInterval = setInterval(() => {
        totalSeconds++;
        const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
        const secs = String(totalSeconds % 60).padStart(2, '0');
        if (display) display.innerText = `${mins}:${secs}`;
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function getFormattedTime() {
    const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const secs = String(totalSeconds % 60).padStart(2, '0');
    return `${mins}분 ${secs}초`;
}

window.addEventListener('popstate', (event) => {
    const currentActiveScreen = document.querySelector('.view-screen:not(.hidden)');
    if (currentActiveScreen && currentActiveScreen.id === 'quiz-screen') {
        history.pushState({ screen: 'quiz-screen' }, '', '');
        exitQuiz();
        return;
    }
    if (event.state && event.state.screen) {
        showScreen(event.state.screen, false);
    } else {
        showScreen('setup-screen', false);
    }
});

function navigateTo(screenId) {
    history.pushState({ screen: screenId }, '', '');
    showScreen(screenId, true);
}

function handleHeaderBack() { 
    const currentActiveScreen = document.querySelector('.view-screen:not(.hidden)');
    if (currentActiveScreen && currentActiveScreen.id === 'quiz-screen') {
        exitQuiz();
    } else {
        window.history.back(); 
    }
}

function showScreen(id, updateHistory = true) {
    const screens = ['setup-screen', 'quiz-screen', 'result-screen', 'wordlist-screen', 'history-screen'];
    screens.forEach(s => { const el = document.getElementById(s); if (el) el.classList.add('hidden'); });
    
    const target = document.getElementById(id);
    if (target) target.classList.remove('hidden');

    const backBtn = document.getElementById('nav-back-btn');
    if (backBtn) {
        if (id === 'setup-screen') backBtn.classList.add('hidden');
        else backBtn.classList.remove('hidden');
    }

    const tocBtn = document.getElementById('toc-btn');
    if (tocBtn) {
        if (id === 'wordlist-screen') tocBtn.classList.remove('hidden');
        else tocBtn.classList.add('hidden');
    }

    const timerDisp = document.getElementById('timer-display');
    if (timerDisp && id !== 'quiz-screen') {
        timerDisp.classList.add('hidden');
        stopTimer();
    }

    if (id === 'wordlist-screen') viewWordList();
    if (id === 'history-screen') viewHistory();
}

function toggleTOC() {
    const layer = document.getElementById('toc-layer');
    if (!layer) return;
    if (layer.classList.contains('hidden')) {
        const container = document.getElementById('toc-buttons-container');
        if (container) {
            container.innerHTML = '';
            for (let i = 1; i <= 30; i++) {
                const btn = document.createElement('button');
                btn.className = 'toc-day-btn';
                btn.innerText = `${i}`;
                btn.onclick = () => scrollToDay(i);
                container.appendChild(btn);
            }
        }
        layer.classList.remove('hidden');
    } else {
        layer.classList.add('hidden');
    }
}

function scrollToDay(dayNum) {
    toggleTOC();
    const targetEl = document.getElementById(`day-anchor-${dayNum}`);
    if (targetEl) {
        const offset = 65;
        const bodyRect = document.body.getBoundingClientRect().top;
        const elementRect = targetEl.getBoundingClientRect().top;
        const elementPosition = elementRect - bodyRect;
        const offsetPosition = elementPosition - offset;

        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });
    } else {
        alert(`DAY ${dayNum} 섹션이 현재 단어장에 존재하지 않습니다.`);
    }
}

function getHintAndInputSetup(fullWord, option, rowIdx) {
    const words = fullWord.split(' ');
    let htmlStructure = '';
    let targetAnswers = [];

    htmlStructure += `<div style="display: inline-flex; align-items: flex-end; flex-wrap: wrap; row-gap: 10px; min-height: 2.5rem; vertical-align: bottom;">`;

    words.forEach((word, wIdx) => {
        let n = word.length;
        let hintLen = 0;
        
        if (wIdx === 0 && option !== 'none') {
            if (option === 'half') {
                if (n % 2 !== 0) hintLen = (n - 1) / 2;
                else hintLen = n / 2;
                if (hintLen < 1 && n > 0) hintLen = 1; 
            } else {
                hintLen = parseInt(option) || 1;
            }

            if (hintLen >= n && n > 1) {
                hintLen = 1;
            } else if (hintLen >= n && n === 1) {
                hintLen = 0;
            }
        }

        const hintText = word.slice(0, hintLen);
        const remainTarget = word.slice(hintLen);
        targetAnswers.push(remainTarget);

        htmlStructure += `
            <span class="inline-word-block" style="display: inline-flex; align-items: flex-end; font-family: 'Courier New', Courier, monospace; font-size: 1.8rem; font-weight: bold; margin-right: 24px; user-select: none; height: 2.2rem; line-height: 2.2rem;">
                ${hintText ? `<span class="hint-black" style="color: var(--text); letter-spacing: 2px; margin-right:4px; display: inline-block; height: 2.2rem; line-height: 2.2rem;">${hintText}</span>` : ''}
        `;

        for (let i = 0; i < remainTarget.length; i++) {
            htmlStructure += `
                <span style="display: inline-block; width: 18px; border-bottom: 3px solid var(--secondary); margin-right: 4px; text-align: center; position: relative; height: 2.2rem;">
                    <input type="text" class="quiz-answer-input char-input" 
                           data-row-idx="${rowIdx}"
                           data-word-idx="${wIdx}"
                           data-char-idx="${i}"
                           data-char-target="${remainTarget[i]}"
                           maxlength="1" 
                           style="width: 100%; height: 100%; border: none; background: transparent; color: #0047fa; font-family: inherit; font-size: inherit; font-weight: inherit; text-align: center; padding: 0; margin: 0; outline: none; z-index: 2; position: absolute; left: 0; top: 0; line-height: 2.2rem;"
                           onkeydown="handleCharKeyDown(event)"
                           oninput="handleCharInput(event)">
                </span>
            `;
        }
        htmlStructure += `</span>`;
    });

    htmlStructure += `</div>`;
    return { htmlStructure, targetAnswers };
}

function handleCharInput(event) {
    const input = event.target;
    if (input.value.length === 1) {
        const rowIdx = input.getAttribute('data-row-idx');
        const inputs = Array.from(document.querySelectorAll(`.quiz-answer-input[data-row-idx="${rowIdx}"]`));
        const nextIdx = inputs.indexOf(input) + 1;
        if (nextIdx < inputs.length && !inputs[nextIdx].disabled) {
            inputs[nextIdx].focus();
        }
    }
}

function handleCharKeyDown(event) {
    const input = event.target;
    const currentRowIdx = parseInt(input.getAttribute('data-row-idx'));
    const allInputs = Array.from(document.querySelectorAll('.quiz-answer-input'));
    const allRowInputs = allInputs.filter(inp => parseInt(inp.getAttribute('data-row-idx')) === currentRowIdx);
    const curIdxInRow = allRowInputs.indexOf(input);

    if (isSubmitted && event.key === 'Enter') {
        event.preventDefault();
        nextQuestion();
        return;
    }

    if (!isSubmitted) {
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'Tab') {
            event.preventDefault();
            const nextRowInputs = allInputs.filter(inp => parseInt(inp.getAttribute('data-row-idx')) === (currentRowIdx + 1));
            if (nextRowInputs.length > 0) {
                nextRowInputs[0].focus();
            } else {
                submitAnswer();
            }
            return;
        }

        if (event.key === 'Backspace' && input.value.length === 0) {
            if (curIdxInRow > 0) {
                allRowInputs[curIdxInRow - 1].focus();
                allRowInputs[curIdxInRow - 1].value = '';
                event.preventDefault();
            }
            return;
        }
    }
}

// 예문 속 단어/불규칙 변형어/숙어 위치 역추적 함수
function findWordInSentence(word, sentence) {
    // 하이픈(-)은 제거하지 않고 보존
    const cleanSentence = sentence.replace(/[.,\/#!$%\^&\*;:{}=_`~()]/g, ""); 
    const sentenceWords = cleanSentence.split(/\s+/);
    const baseWords = word.split(/\s+/);
    
    let firstWordCandidates = [baseWords[0].toLowerCase()];
    const bw = baseWords[0].toLowerCase();
    
    firstWordCandidates.push(bw + 's', bw + 'es', bw + 'd', bw + 'ed', bw + 'ing');
    if (bw.endsWith('e')) firstWordCandidates.push(bw.slice(0, -1) + 'ing', bw.slice(0, -1) + 'd');
    if (bw.endsWith('y')) firstWordCandidates.push(bw.slice(0, -1) + 'ies', bw.slice(0, -1) + 'ied');
    
    if (irregularVerbs[bw]) {
        firstWordCandidates.push(...irregularVerbs[bw]);
    }

    for (let i = 0; i < sentenceWords.length; i++) {
        let sw = sentenceWords[i].toLowerCase();
        
        if (firstWordCandidates.includes(sw) || sw.startsWith(bw.slice(0, 4))) {
            let match = true;
            let detectedPhrase = [sentenceWords[i]];
            for (let j = 1; j < baseWords.length; j++) {
                if (i + j >= sentenceWords.length || sentenceWords[i+j].toLowerCase() !== baseWords[j].toLowerCase()) {
                    match = false;
                    break;
                }
                detectedPhrase.push(sentenceWords[i+j]);
            }
            if (match) {
                return detectedPhrase.join(" ");
            }
        }
    }

    for (let w of sentenceWords) {
        let clean = w.toLowerCase();
        if (clean.length >= 3 && (clean.startsWith(word.toLowerCase().slice(0, 3)) || word.toLowerCase().startsWith(clean.slice(0, 3)))) {
            return w;
        }
    }
    return word;
}

function startTest(isRetry) {
    let pool = isRetry ? [...wrongWords] : [...allWords];
    currentTestMode = document.getElementById('test-type-input').value;

    if (!isRetry) {
        const labels = { 
            synonym: "동의어 철자", 
            korean: "한국어 뜻 매칭", 
            sentence: "예문 빈칸", 
            sentence_no_meaning: "예문 빈칸 (뜻 숨김)" 
        };
        currentTestTypeLabel = labels[currentTestMode];
        const dayInput = document.getElementById('day-input');
        currentTestDays = dayInput ? dayInput.value.trim() : "1";
        const targetDays = currentTestDays.split(',').map(d => d.trim());
        pool = pool.filter(w => targetDays.includes(w.day));
    } else {
        currentTestTypeLabel = `오답-${currentTestTypeLabel.replace("오답-", "")}`;
        currentTestDays = [...new Set(pool.map(w => w.day))].join(',');
    }

    if (currentTestMode === 'sentence' || currentTestMode === 'sentence_no_meaning') {
        pool = pool.filter(w => w.example.trim() !== '');
    }

    if (pool.length === 0) {
        alert('테스트 조건에 맞는 단어 데이터가 존재하지 않습니다.');
        return;
    }

    const shuffleInput = document.getElementById('shuffle-input');
    if (shuffleInput && shuffleInput.checked) pool.sort(() => Math.random() - 0.5);

    const quizCountInput = document.getElementById('quiz-count');
    let count = quizCountInput ? (parseInt(quizCountInput.value) || 60) : 60;
    if (count > pool.length) count = pool.length;
    
    quizWords = pool.slice(0, count);
    currentIdx = 0;
    score = 0;
    quizReviewData = []; 
    if (!isRetry) wrongWords = [];

    navigateTo('quiz-screen');
    startTimer(); 
    showQuestion();
}

function showQuestion() {
    if (currentIdx >= quizWords.length) return showResult();

    isSubmitted = false;
    document.getElementById('submit-btn').classList.remove('hidden');
    document.getElementById('next-btn').classList.add('hidden');

    const q = quizWords[currentIdx];
    const hintOpt = document.getElementById('hint-count-input').value;
    const container = document.getElementById('inputs-container');
    container.innerHTML = '';

    document.getElementById('quiz-progress').innerText = `${currentIdx + 1} / ${quizWords.length}`;
    
    const wordEl = document.getElementById('quiz-word');
    const posEl = document.getElementById('quiz-pos');
    const extraEl = document.getElementById('quiz-extra');

    extraEl.innerHTML = ''; 

    if (currentTestMode === 'synonym') {
        wordEl.innerText = q.word;
        posEl.innerText = q.pos;

        const reqSynCount = parseInt(document.getElementById('synonym-count-input').value) || 2;
        currentTargetSynonyms = q.synonyms.slice(0, reqSynCount);

        currentTargetSynonyms.forEach((syn, index) => {
            const setup = getHintAndInputSetup(syn, hintOpt, index);
            const row = document.createElement('div');
            row.className = 'synonym-row';
            row.style.marginBottom = "25px";
            row.innerHTML = `
                <div style="font-size:0.85rem; color:var(--secondary); margin-bottom:6px;">동의어 ${index + 1}</div>
                <div class="inline-input-wrapper" style="display:flex; align-items:baseline; flex-wrap:wrap; gap:10px; vertical-align:baseline;">
                    ${setup.htmlStructure}
                    <span class="feedback" id="feedback-${index}" style="vertical-align:baseline;"></span>
                </div>
            `;
            container.appendChild(row);
        });

    } else if (currentTestMode === 'korean') {
        wordEl.innerText = q.meaning;
        posEl.innerText = q.pos;

        const setup = getHintAndInputSetup(q.word, hintOpt, 0);
        const row = document.createElement('div');
        row.className = 'synonym-row';
        row.innerHTML = `
            <div class="inline-input-wrapper" style="display:flex; align-items:baseline; flex-wrap:wrap; gap:10px; vertical-align:baseline;">
                ${setup.htmlStructure}
                <span class="feedback" id="feedback-0" style="vertical-align:baseline;"></span>
            </div>
        `;
        container.appendChild(row);

    } else if (currentTestMode === 'sentence' || currentTestMode === 'sentence_no_meaning') {
        wordEl.innerText = ''; 
        posEl.innerText = '';

        const targetWord = findWordInSentence(q.word, q.example);
        const setup = getHintAndInputSetup(targetWord, hintOpt, 0);
        
        const sentenceWithInput = q.example.replace(new RegExp(`\\b${targetWord}\\b`, 'i'), `
            <span style="display:inline-flex; align-items:baseline; background:rgba(0,0,0,0.04); padding: 4px 8px; border-radius:6px; vertical-align:baseline; flex-wrap:wrap; gap:2px; line-height: 2.2rem;">
                ${setup.htmlStructure}
                <span class="feedback" id="feedback-0" style="margin-left:5px; vertical-align:baseline;"></span>
            </span>
        `);
        
        const meaningHTML = currentTestMode === 'sentence' ? `<div class="quiz-sentence-meaning" style="font-size:0.95rem; color:var(--secondary);">${q.exampleMeaning}</div>` : '';

        extraEl.innerHTML = `
            <div class="quiz-sentence-text" style="margin-bottom:15px; font-weight:600; line-height:1.8; font-size:1.2rem;">${sentenceWithInput}</div>
            ${meaningHTML}
        `;
    }

    const firstInput = document.querySelector('.quiz-answer-input');
    if (firstInput) firstInput.focus();
}

function submitAnswer() {
    if (isSubmitted) return;

    let allCorrect = true;
    const q = quizWords[currentIdx];
    let userAnswersSummary = []; 
    let correctAnswersSummary = [];

    if (currentTestMode === 'synonym') {
        const rows = document.querySelectorAll('.synonym-row');
        rows.forEach((row, index) => {
            const inputs = row.querySelectorAll('.quiz-answer-input');
            let rowCorrect = true;
            let fullCorrectAnswer = currentTargetSynonyms[index];
            
            const hintEl = row.querySelector('.hint-black');
            let hintPart = hintEl ? hintEl.innerText : "";
            let userTypedPart = "";

            inputs.forEach(inputEl => {
                userTypedPart += inputEl.value; 
                const userChar = inputEl.value.trim().toLowerCase();
                const correctChar = inputEl.getAttribute('data-char-target').toLowerCase();
                inputEl.disabled = true;
                if (userChar !== correctChar) {
                    rowCorrect = false;
                    allCorrect = false;
                }
            });

            userAnswersSummary.push(hintPart + userTypedPart);
            correctAnswersSummary.push(fullCorrectAnswer);

            const feedbackEl = document.getElementById(`feedback-${index}`);
            if (feedbackEl) {
                if (rowCorrect) {
                    feedbackEl.className = 'feedback correct';
                    feedbackEl.innerText = '⭕';
                } else {
                    feedbackEl.className = 'feedback wrong';
                    feedbackEl.innerText = `❌ (${fullCorrectAnswer})`;
                }
            }
        });
    } else {
        const container = document.getElementById('inputs-container');
        const extraContainer = document.getElementById('quiz-extra');
        const activeContainer = (currentTestMode === 'sentence' || currentTestMode === 'sentence_no_meaning') ? extraContainer : container;
        
        const inputs = activeContainer.querySelectorAll('.quiz-answer-input');
        let modeCorrect = true;
        let fullWordTarget = (currentTestMode === 'korean') ? q.word : findWordInSentence(q.word, q.example);
        
        const hintEl = activeContainer.querySelector('.hint-black');
        let hintPart = hintEl ? hintEl.innerText : "";
        let userTypedPart = "";

        inputs.forEach(inputEl => {
            userTypedPart += inputEl.value;
            const userChar = inputEl.value.trim().toLowerCase();
            const correctChar = inputEl.getAttribute('data-char-target').toLowerCase();
            inputEl.disabled = true;
            if (userChar !== correctChar) {
                modeCorrect = false;
                allCorrect = false;
            }
        });

        userAnswersSummary.push(hintPart + userTypedPart);
        correctAnswersSummary.push(fullWordTarget);

        const feedbackEl = document.getElementById('feedback-0');
        if (feedbackEl) {
            if (modeCorrect) {
                feedbackEl.className = 'feedback correct';
                feedbackEl.innerText = '⭕';
            } else {
                feedbackEl.className = 'feedback wrong';
                feedbackEl.innerText = `❌ (${fullWordTarget})`;
            }
        }
    }

    if (allCorrect) score++;
    else {
        if (q && !wrongWords.some(w => w.word === q.word)) wrongWords.push(q);
    }

    let questionTextForReview = "";
    if (currentTestMode === 'synonym') {
        questionTextForReview = `${q.word} <span style="font-size:0.85rem; font-style:italic; color:var(--secondary);">(${q.pos})</span>`;
    } else if (currentTestMode === 'korean') {
        questionTextForReview = `${q.meaning} <span style="font-size:0.85rem; font-style:italic; color:var(--secondary);">(${q.pos})</span>`;
    } else if (currentTestMode === 'sentence' || currentTestMode === 'sentence_no_meaning') {
        const meaningHTML = currentTestMode === 'sentence' ? `<div style="font-size:0.85rem; color:var(--secondary); margin-top:2px;">${q.exampleMeaning}</div>` : '';
        questionTextForReview = `<div style="font-weight:600;">${q.example}</div>${meaningHTML}`;
    }

    quizReviewData.push({
        questionHTML: questionTextForReview,
        isCorrect: allCorrect,
        userAns: userAnswersSummary.join(' / '),
        correctAns: correctAnswersSummary.join(' / ')
    });

    try { localStorage.setItem('wrongWords', JSON.stringify(wrongWords)); } catch (e) {}
    
    isSubmitted = true;
    document.getElementById('submit-btn').classList.add('hidden');
    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) { nextBtn.classList.remove('hidden'); nextBtn.focus(); }
}

function nextQuestion() { currentIdx++; showQuestion(); }
function exitQuiz() { if (confirm('테스트를 중단하시겠습니까? 푼 문항만 기록에 저장됩니다.')) showResult(true); }

function saveQuizRecord(totalCount, correctCount) {
    try {
        const historyData = JSON.parse(localStorage.getItem('quizHistory') || '[]');
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
        
        historyData.unshift({
            date: dateStr,
            type: currentTestTypeLabel,
            days: currentTestDays,
            total: totalCount,
            correct: correctCount,
            time: getFormattedTime() 
        });
        localStorage.setItem('quizHistory', JSON.stringify(historyData));
    } catch (e) {}
}

function showResult(isInterrupted = false) {
    stopTimer(); 
    showScreen('result-screen', false);
    const totalAttempted = isInterrupted ? (isSubmitted ? currentIdx + 1 : currentIdx) : (quizWords ? quizWords.length : 0);
    const timeTakenStr = getFormattedTime();

    const scoreEl = document.getElementById('result-score');
    if (scoreEl) {
        scoreEl.innerText = isInterrupted 
            ? `⏱️ 소요 시간: ${timeTakenStr}\n테스트가 중단되었습니다.\n푼 문제: ${totalAttempted}문제 중 ${score}문제 맞춤`
            : `⏱️ 소요 시간: ${timeTakenStr}\n테스트 완료!\n총 ${totalAttempted}문제 중 ${score}문제 맞추셨습니다.`;
    }
    if (totalAttempted > 0) saveQuizRecord(totalAttempted, score);
    
    buildReviewList();
    checkWrongHistory();
}

function buildReviewList() {
    const container = document.getElementById('review-container');
    if (!container) return;
    if (quizReviewData.length === 0) {
        container.innerHTML = '<p>리뷰할 문항 데이터가 존재하지 않습니다.</p>';
        return;
    }

    container.innerHTML = quizReviewData.map((item, idx) => {
        const statusClass = item.isCorrect ? 'review-correct' : 'review-wrong';
        const labelText = item.isCorrect ? '<span class="review-label-correct">⭕ 정답</span>' : '<span class="review-label-wrong">❌ 오답</span>';
        return `
            <div class="review-item ${statusClass}">
                ${labelText}
                <div style="margin-bottom:6px;"><strong>Q${idx + 1}.</strong> ${item.questionHTML}</div>
                <div style="font-size:0.95rem; border-top: 1px dashed rgba(0,0,0,0.05); padding-top: 6px; margin-top: 6px;">
                    <span style="color:var(--secondary);">제출한 답:</span> ${item.userAns || '(공백)'}<br>
                    <span style="color:var(--secondary);">실제 정답:</span> <strong style="color:var(--text);">${item.correctAns}</strong>
                </div>
            </div>
        `;
    }).join('');
}

function viewWordList() {
    const content = document.getElementById('wordlist-content');
    if (!content) return;
    if (allWords.length === 0) { content.innerHTML = '<p>불러온 단어가 없습니다.</p>'; return; }

    const grouped = {};
    allWords.forEach(w => { if (!grouped[w.day]) grouped[w.day] = []; grouped[w.day].push(w); });

    let html = '';
    Object.keys(grouped).sort((a, b) => Number(a) - Number(b)).forEach(day => {
        html += `<div class="day-section" id="day-anchor-${day}">`;
        html += `<h4 class="day-header">DAY ${day}</h4>`;
        grouped[day].forEach(w => {
            html += `
                <div class="word-item">
                    <strong>${w.word}</strong><span class="pos-tag">${w.pos}</span>
                    <span class="meaning-text">${w.meaning}</span>
                    <span class="syn-list">${w.synonyms.join(', ')}</span>
                    ${w.example ? `<span class="example-box">💡 ${w.example}<br>➔ ${w.exampleMeaning}</span>` : ''}
                </div>
            `;
        });
        html += `</div>`;
    });
    content.innerHTML = html;
}

function viewHistory() {
    const content = document.getElementById('history-content');
    if (!content) return;
    let historyData = [];
    try { historyData = JSON.parse(localStorage.getItem('quizHistory') || '[]'); } catch (e) {}

    if (historyData.length === 0) { content.innerHTML = '<p>저장된 테스트 기록이 없습니다.</p>'; return; }

    content.innerHTML = historyData.map(h => `
        <div class="history-item">
            <strong>일시:</strong> ${h.date || ''} (소요 시간: ${h.time || '기록 없음'})<br>
            <strong>종류:</strong> ${h.type || '동의어 철자'} (DAY ${h.days || ''})<br>
            <strong>결과:</strong> ${h.total || 0}문제 중 ${h.correct || 0}문제 정답 (${h.total ? Math.round((h.correct/h.total)*100) : 0}%)
        </div>
    `).join('');
}

function exportHistory() {
    let historyData = [];
    try { historyData = JSON.parse(localStorage.getItem('quizHistory') || '[]'); } catch (e) {}
    if (historyData.length === 0) { alert('내보낼 기록이 없습니다.'); return; }

    let textContent = "영어 단어 테스트 기록\n====================\n\n";
    historyData.forEach((h, idx) => {
        textContent += `[기록 ${idx + 1}]\n일시: ${h.date || ''} (소요시간: ${h.time || '없음'})\n종류: ${h.type || ''} (DAY: ${h.days || ''})\n결과: ${h.total || 0}문제 중 ${h.correct || 0}문제 맞춤 (${h.total ? Math.round((h.correct/h.total)*100) : 0}%)\n--------------------\n`;
    });

    const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `word_test_history_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function clearHistory() {
    if (confirm('모든 테스트 기록을 삭제하시겠습니까?')) {
        try { localStorage.removeItem('quizHistory'); } catch (e) {}
        viewHistory();
    }
}

function showSetupView() { navigateTo('setup-screen'); }
function toggleDarkMode() {
    const current = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
}