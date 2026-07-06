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

// CSV 파싱 및 인코딩 처리
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
            if (char === '"' || char === "'") {
                insideQuote = !insideQuote;
            } else if (char === ',' && !insideQuote) {
                parts.push(currentPart.trim());
                currentPart = '';
            } else {
                currentPart += char;
            }
        }
        parts.push(currentPart.trim());
        
        parts = parts.map(item => item.replace(/^["']|["']$/g, '').trim());

        if (parts.length >= 3) {
            result.push({
                day: parts[0],
                word: parts[1],
                pos: parts[2],
                synonyms: [parts[3], parts[4], parts[5], parts[6]].filter(Boolean),
                meaning: parts[7] || '',
                example: parts[8] || '',
                exampleMeaning: parts[9] || ''
            });
        }
    }
    return result;
}

fetch('data.csv')
    .then(res => { 
        if (!res.ok) throw new Error(); 
        return res.arrayBuffer(); 
    })
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

// 브라우저 및 아이폰 뒤로가기(스와이프) 제어 연동 고도화
window.addEventListener('popstate', (event) => {
    const currentActiveScreen = document.querySelector('.view-screen:not(.hidden)');
    
    // 테스트 도중 뒤로가기 시도를 감지하면 중단 절차 작동
    if (currentActiveScreen && currentActiveScreen.id === 'quiz-screen') {
        // 히스토리를 강제로 복구시켜 화면 이탈을 방지한 뒤 중단 얼럿 띄움
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

    if (id === 'wordlist-screen') viewWordList();
    if (id === 'history-screen') viewHistory();
}

// 가로 스크롤 문제를 완벽 차단하기 위해 글자수 단위 개별 단독 인풋 생성 알고리즘으로 전면 전개
function getHintAndInputSetup(fullWord, option, rowIdx) {
    const words = fullWord.split(' ');
    let htmlStructure = '';
    let targetAnswers = [];

    words.forEach((word, wIdx) => {
        let n = word.length;
        let hintLen = 0;
        
        if (wIdx === 0) {
            if (option === 'half') {
                if (n % 2 !== 0) hintLen = (n - 1) / 2;
                else hintLen = n / 2;
                if (hintLen < 1 && n > 0) hintLen = 1; 
            } else {
                hintLen = parseInt(option) || 1;
                if (hintLen > n) hintLen = n;
            }
        }

        const hintText = word.slice(0, hintLen);
        const remainTarget = word.slice(hintLen);
        targetAnswers.push(remainTarget);

        htmlStructure += `
            <span class="inline-word-block" style="display: inline-flex; align-items: baseline; font-family: 'Courier New', Courier, monospace; font-size: 1.8rem; font-weight: bold; margin-right: 20px; user-select: none;">
                <!-- 검은색 힌트 표시 -->
                <span class="hint-black" style="color: var(--text); letter-spacing: 2px; margin-right:4px;">${hintText}</span>
        `;

        // 가로 스크롤 원천 봉쇄: 남은 글자수만큼 한 글자씩 개별 인풋 칸을 독립 나열
        for (let i = 0; i < remainTarget.length; i++) {
            htmlStructure += `
                <span style="display: inline-block; width: 18px; border-bottom: 3px solid var(--secondary); margin-right: 4px; text-align: center; position: relative; height: 2.2rem; vertical-align: baseline;">
                    <input type="text" class="quiz-answer-input char-input" 
                           data-row-idx="${rowIdx}"
                           data-word-idx="${wIdx}"
                           data-char-idx="${i}"
                           data-char-target="${remainTarget[i]}"
                           maxlength="1" 
                           style="width: 100%; height: 100%; border: none; background: transparent; color: #0047fa; font-family: inherit; font-size: inherit; font-weight: inherit; text-align: center; padding: 0; margin: 0; outline: none; z-index: 2; position: absolute; left: 0; top: 0;"
                           onkeydown="handleCharKeyDown(event)"
                           oninput="handleCharInput(event)">
                </span>
            `;
        }
        htmlStructure += `</span>`;
    });

    return { htmlStructure, targetAnswers };
}

// 글자 입력 즉시 다음 칸으로 자동 커서 이동 처리 로직
function handleCharInput(event) {
    const input = event.target;
    if (input.value.length === 1) {
        const inputs = Array.from(document.querySelectorAll('.quiz-answer-input'));
        const nextIdx = inputs.indexOf(input) + 1;
        if (nextIdx < inputs.length && !inputs[nextIdx].disabled) {
            inputs[nextIdx].focus();
        }
    }
}

// 낱자 제어 키 이벤트 제어 (백스페이스 및 특수 기능 이동 키 바인딩)
function handleCharKeyDown(event) {
    const input = event.target;
    const inputs = Array.from(document.querySelectorAll('.quiz-answer-input'));
    const curIdx = inputs.indexOf(input);

    if (isSubmitted && event.key === 'Enter') {
        event.preventDefault();
        nextQuestion();
        return;
    }

    if (!isSubmitted) {
        if (event.key === 'Backspace' && input.value.length === 0) {
            // 글자가 없는 상태에서 백스페이스 누르면 이전 칸으로 이동 및 글자 지우기
            if (curIdx > 0) {
                inputs[curIdx - 1].focus();
                inputs[curIdx - 1].value = '';
                event.preventDefault();
            }
        } else if (event.key === 'Enter' || event.key === ' ' || event.key === 'Tab') {
            event.preventDefault();
            
            // 공백, 엔터, 탭 처리 기믹 고도화 및 다음 칸/제출로 점프
            if (curIdx < inputs.length - 1) {
                inputs[curIdx + 1].focus();
            } else {
                submitAnswer();
            }
        }
    }
}

function startTest(isRetry) {
    let pool = isRetry ? [...wrongWords] : [...allWords];
    currentTestMode = document.getElementById('test-type-input').value;

    if (!isRetry) {
        const labels = { synonym: "동의어 철자", korean: "한국어 뜻 매칭", sentence: "예문 빈칸" };
        currentTestTypeLabel = labels[currentTestMode];
        const dayInput = document.getElementById('day-input');
        currentTestDays = dayInput ? dayInput.value.trim() : "1";
        const targetDays = currentTestDays.split(',').map(d => d.trim());
        pool = pool.filter(w => targetDays.includes(w.day));
    } else {
        currentTestTypeLabel = `오답-${currentTestTypeLabel.replace("오답-", "")}`;
        currentTestDays = [...new Set(pool.map(w => w.day))].join(',');
    }

    if (currentTestMode === 'sentence') {
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
    if (!isRetry) wrongWords = [];

    navigateTo('quiz-screen');
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
                <div class="inline-input-wrapper" style="display:flex; align-items:center; flex-wrap:wrap; gap:10px;">
                    ${setup.htmlStructure}
                    <span class="feedback" id="feedback-${index}"></span>
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
            <div class="inline-input-wrapper" style="display:flex; align-items:center; flex-wrap:wrap; gap:10px;">
                ${setup.htmlStructure}
                <span class="feedback" id="feedback-0"></span>
            </div>
        `;
        container.appendChild(row);

    } else if (currentTestMode === 'sentence') {
        // 예문 빈칸 채우기 테스트 시 단어 자체의 한국어 뜻 노출 제거
        wordEl.innerText = ''; 
        posEl.innerText = q.pos;

        const baseWord = q.word.toLowerCase();
        const wordsInSentence = q.example.split(/[\s,.:;?!"'()]+/);
        
        let detectedWord = q.word; 
        for (let w of wordsInSentence) {
            let clean = w.toLowerCase().trim();
            if (clean.length >= 3 && (clean.startsWith(baseWord.slice(0, 3)) || baseWord.startsWith(clean.slice(0, 3)))) {
                detectedWord = w; 
                break;
            }
        }

        const targetWord = detectedWord.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
        const setup = getHintAndInputSetup(targetWord, hintOpt, 0);
        
        const sentenceWithInput = q.example.replace(new RegExp(`\\b${targetWord}\\b`, 'i'), `
            <span style="display:inline-flex; align-items:baseline; background:rgba(0,0,0,0.04); padding: 4px 8px; border-radius:6px; vertical-align:middle; flex-wrap:wrap; gap:2px;">
                ${setup.htmlStructure}
                <span class="feedback" id="feedback-0" style="margin-left:5px;"></span>
            </span>
        `);
        
        // 예문과 예문 뜻만 출력되도록 구조 정제
        extraEl.innerHTML = `
            <div style="margin-bottom:15px; font-weight:600; line-height:1.8; font-size:1.2rem;">${sentenceWithInput}</div>
            <div style="font-size:0.95rem; color:var(--secondary);">${q.exampleMeaning}</div>
        `;
    }

    const firstInput = document.querySelector('.quiz-answer-input');
    if (firstInput) firstInput.focus();
}

function submitAnswer() {
    if (isSubmitted) return;

    let allCorrect = true;

    if (currentTestMode === 'synonym') {
        const rows = document.querySelectorAll('.synonym-row');
        rows.forEach((row, index) => {
            const inputs = row.querySelectorAll('.quiz-answer-input');
            let rowCorrect = true;
            let fullCorrectAnswer = currentTargetSynonyms[index];

            inputs.forEach(inputEl => {
                const userChar = inputEl.value.trim().toLowerCase();
                const correctChar = inputEl.getAttribute('data-char-target').toLowerCase();
                inputEl.disabled = true;
                if (userChar !== correctChar) {
                    rowCorrect = false;
                    allCorrect = false;
                }
            });

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
        const inputs = document.querySelectorAll('.quiz-answer-input');
        let modeCorrect = true;
        let fullWordTarget = (currentTestMode === 'korean') ? quizWords[currentIdx].word : extraElTargetWord();

        inputs.forEach(inputEl => {
            const userChar = inputEl.value.trim().toLowerCase();
            const correctChar = inputEl.getAttribute('data-char-target').toLowerCase();
            inputEl.disabled = true;
            if (userChar !== correctChar) {
                modeCorrect = false;
                allCorrect = false;
            }
        });

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

    const q = quizWords[currentIdx];
    if (allCorrect) score++;
    else {
        if (q && !wrongWords.some(w => w.word === q.word)) wrongWords.push(q);
    }

    try { localStorage.setItem('wrongWords', JSON.stringify(wrongWords)); } catch (e) {}
    
    isSubmitted = true;
    document.getElementById('submit-btn').classList.add('hidden');
    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) { 
        nextBtn.classList.remove('hidden'); 
        nextBtn.focus(); 
    }
}

function extraElTargetWord() {
    const q = quizWords[currentIdx];
    const baseWord = q.word.toLowerCase();
    const wordsInSentence = q.example.split(/[\s,.:;?!"'()]+/);
    let detectedWord = q.word; 
    for (let w of wordsInSentence) {
        let clean = w.toLowerCase().trim();
        if (clean.length >= 3 && (clean.startsWith(baseWord.slice(0, 3)) || baseWord.startsWith(clean.slice(0, 3)))) {
            detectedWord = w; 
            break;
        }
    }
    return detectedWord.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
}

function nextQuestion() { currentIdx++; showQuestion(); }

function exitQuiz() { 
    if (confirm('테스트를 중단하시겠습니까? 푼 문항만 기록에 저장됩니다.')) {
        // 중단 확정 시 브라우저 히스토리 스택을 하나 제거하여 덮어쓰기 히스토리 무력화 후 결과 노출
        showResult(true); 
    }
}

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
            correct: correctCount
        });
        localStorage.setItem('quizHistory', JSON.stringify(historyData));
    } catch (e) {}
}

function showResult(isInterrupted = false) {
    showScreen('result-screen', false);
    const totalAttempted = isInterrupted ? (isSubmitted ? currentIdx + 1 : currentIdx) : (quizWords ? quizWords.length : 0);
    
    const scoreEl = document.getElementById('result-score');
    if (scoreEl) {
        scoreEl.innerText = isInterrupted 
            ? `테스트가 중단되었습니다.\n푼 문제: ${totalAttempted}문제 중 ${score}문제 맞춤`
            : `테스트 완료!\n총 ${totalAttempted}문제 중 ${score}문제 맞추셨습니다.`;
    }
    if (totalAttempted > 0) saveQuizRecord(totalAttempted, score);
    checkWrongHistory();
}

function viewWordList() {
    const content = document.getElementById('wordlist-content');
    if (!content) return;
    if (allWords.length === 0) { content.innerHTML = '<p>불러온 단어가 없습니다.</p>'; return; }

    const grouped = {};
    allWords.forEach(w => { if (!grouped[w.day]) grouped[w.day] = []; grouped[w.day].push(w); });

    let html = '';
    Object.keys(grouped).sort((a, b) => Number(a) - Number(b)).forEach(day => {
        html += `<div class="day-section">`;
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
            <strong>일시:</strong> ${h.date || ''}<br>
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
        textContent += `[기록 ${idx + 1}]\n일시: ${h.date || ''}\n종류: ${h.type || ''} (DAY: ${h.days || ''})\n결과: ${h.total || 0}문제 중 ${h.correct || 0}문제 맞춤 (${h.total ? Math.round((h.correct/h.total)*100) : 0}%)\n--------------------\n`;
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