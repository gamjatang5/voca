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

// CSV 파싱 및 한글 깨짐 방지 디코딩 처리
function parseCSV(text) {
    // 엑셀에서 생성된 UTF-8 CSV 파일의 BOM(Byte Order Mark) 제거
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

// 파일 읽어올 때 텍스트 디코더 적용으로 한글 깨짐 현상 차단
fetch('data.csv')
    .then(res => { 
        if (!res.ok) throw new Error(); 
        return res.arrayBuffer(); 
    })
    .then(buffer => {
        // UTF-8 디코더 명시로 한글 인코딩 깨짐을 원천 방지
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(buffer);
        allWords = parseCSV(text); 
        checkWrongHistory(); 
    })
    .catch(() => alert('data.csv 파일을 불러오지 못했습니다. 파일 인코딩(UTF-8)을 확인해 주세요.'));

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

function toggleSetupOptions() {
    const mode = document.getElementById('test-type-input').value;
    const synGroup = document.getElementById('synonym-count-group');
    if (mode === 'synonym') synGroup.classList.remove('hidden');
    else synGroup.classList.add('hidden');
}

window.addEventListener('popstate', (event) => {
    if (event.state && event.state.screen) showScreen(event.state.screen, false);
    else showScreen('setup-screen', false);
});

function navigateTo(screenId) {
    history.pushState({ screen: screenId }, '', '');
    showScreen(screenId, true);
}

function handleHeaderBack() { window.history.back(); }

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

function calculateHint(word, option) {
    let hintLen = 1;
    if (option === 'half') {
        hintLen = Math.floor(word.length / 2);
        if (word.length % 2 !== 0) hintLen = Math.floor((word.length - 1) / 2);
        if (hintLen < 1) hintLen = 1;
    } else {
        hintLen = parseInt(option) || 1;
    }
    return word.slice(0, hintLen) + '_'.repeat(Math.max(0, word.length - hintLen));
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

    if (currentTestMode === 'synonym') {
        wordEl.innerText = q.word;
        posEl.innerText = q.pos;
        extraEl.innerText = '';

        const reqSynCount = parseInt(document.getElementById('synonym-count-input').value) || 2;
        currentTargetSynonyms = q.synonyms.slice(0, reqSynCount);

        currentTargetSynonyms.forEach((syn, index) => {
            const hint = calculateHint(syn, hintOpt);
            createInputRow(container, index, `동의어 ${index + 1}`, hint);
        });

    } else if (currentTestMode === 'korean') {
        wordEl.innerText = q.meaning;
        posEl.innerText = q.pos;
        extraEl.innerText = '';

        currentTargetSynonyms = [q.word];
        const hint = calculateHint(q.word, hintOpt);
        createInputRow(container, 0, '영단어 입력', hint);

    } else if (currentTestMode === 'sentence') {
        wordEl.innerText = q.meaning; 
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

        currentTargetSynonyms = [detectedWord.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"")];
        
        const hint = calculateHint(currentTargetSynonyms[0], hintOpt);
        
        // 정답 단어 글자수만큼의 언더바(_) 칸을 생성하여 문장 내 가독성 확보
        const blankRepresentation = "[ " + "_ ".repeat(currentTargetSynonyms[0].length).trim() + " ]";
        const blankSentence = q.example.replace(new RegExp(`\\b${currentTargetSynonyms[0]}\\b`, 'i'), blankRepresentation);
        
        extraEl.innerHTML = `<div style="margin-bottom:10px; font-weight:600;">${blankSentence}</div><div style="font-size:0.95rem; color:var(--secondary);">${q.exampleMeaning}</div>`;
        createInputRow(container, 0, '빈칸 단어 입력', hint);
    }

    const firstInput = container.querySelector('input');
    if (firstInput) firstInput.focus();
}

function createInputRow(container, index, labelText, hintText) {
    const row = document.createElement('div');
    row.className = 'synonym-row';
    row.innerHTML = `
        <label>${labelText}</label>
        <div class="hint-text">${hintText.split('').join(' ')}</div>
        <div class="input-container">
            <input type="text" class="quiz-answer-input" data-index="${index}" placeholder="정답 입력" onkeydown="handleKeyDown(event)">
            <span class="feedback" id="feedback-${index}"></span>
        </div>
    `;
    container.appendChild(row);
}

// 엔터 클릭 핸들러 수정: 엔터를 쳤을 때 실제 제출/다음 버튼 동작을 가동
function handleKeyDown(event) {
    if (event.key === 'Enter') {
        event.preventDefault(); // 기본 개행 동작 정지
        if (!isSubmitted) {
            submitAnswer();
        } else {
            nextQuestion();
        }
    }
}

function submitAnswer() {
    if (isSubmitted) return;

    const inputElements = document.querySelectorAll('.quiz-answer-input');
    let allCorrect = true;

    inputElements.forEach(inputEl => {
        const idx = parseInt(inputEl.getAttribute('data-index'));
        const userAns = inputEl.value.trim().toLowerCase();
        const correctAns = currentTargetSynonyms[idx] ? currentTargetSynonyms[idx].toLowerCase() : '';
        const feedbackEl = document.getElementById(`feedback-${idx}`);

        inputEl.disabled = true;

        if (feedbackEl) {
            if (userAns === correctAns && correctAns !== '') {
                feedbackEl.className = 'feedback correct';
                feedbackEl.innerText = '⭕';
            } else {
                allCorrect = false;
                feedbackEl.className = 'feedback wrong';
                feedbackEl.innerText = `❌ (${currentTargetSynonyms[idx]})`;
            }
        }
    });

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