let allWords = [];
let quizWords = [];
let wrongWords = [];
let currentIdx = 0;
let score = 0;
let currentTargetSynonyms = [];
let isSubmitted = false;
let currentTestType = "동의어 철자";
let currentTestDays = "";

function parseCSV(text) {
    const lines = text.split(/\r?\n/);
    const result = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(',').map(item => item.replace(/^["']|["']$/g, '').trim());
        if (parts.length >= 3) {
            result.push({
                day: parts[0],
                word: parts[1],
                pos: parts[2],
                synonyms: parts.slice(3).filter(Boolean)
            });
        }
    }
    return result;
}

fetch('data.csv')
    .then(res => { if (!res.ok) throw new Error(); return res.text(); })
    .then(text => { allWords = parseCSV(text); checkWrongHistory(); })
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

// 브라우저 마우스/아이폰 스와이프 뒤로가기 연동 (History API 제어)
window.addEventListener('popstate', (event) => {
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
    window.history.back();
}

function showScreen(id, updateHistory = true) {
    const screens = ['setup-screen', 'quiz-screen', 'result-screen', 'wordlist-screen', 'history-screen'];
    screens.forEach(s => {
        const el = document.getElementById(s);
        if (el) el.classList.add('hidden');
    });
    
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

function startTest(isRetry) {
    let pool = isRetry ? [...wrongWords] : [...allWords];
    if (!isRetry) {
        currentTestType = "동의어 철자";
        const dayInput = document.getElementById('day-input');
        currentTestDays = dayInput ? dayInput.value.trim() : "1";
        const targetDays = currentTestDays.split(',').map(d => d.trim());
        pool = pool.filter(w => targetDays.includes(w.day));
    } else {
        currentTestType = "동의어 철자 오답";
        currentTestDays = [...new Set(pool.map(w => w.day))].join(',');
    }

    if (pool.length === 0) {
        alert('해당하는 단어가 없습니다.');
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
    const hintCountInput = document.getElementById('hint-count-input');
    const synonymCountInput = document.getElementById('synonym-count-input');
    
    const hintOpt = hintCountInput ? hintCountInput.value : "1";
    const reqSynCount = synonymCountInput ? (parseInt(synonymCountInput.value) || 2) : 2;

    document.getElementById('quiz-progress').innerText = `${currentIdx + 1} / ${quizWords.length}`;
    document.getElementById('quiz-word').innerText = q.word;
    document.getElementById('quiz-pos').innerText = q.pos;

    currentTargetSynonyms = q.synonyms.slice(0, reqSynCount);

    const container = document.getElementById('inputs-container');
    if (container) {
        container.innerHTML = '';
        currentTargetSynonyms.forEach((syn, index) => {
            // 힌트 글자 수 계산 로직 (절반 옵션 적용: 홀수면 -1 처리)
            let hintLen = 1;
            if (hintOpt === 'half') {
                hintLen = Math.floor(syn.length / 2);
                if (syn.length % 2 !== 0) hintLen = Math.floor((syn.length - 1) / 2);
                if (hintLen < 1) hintLen = 1; // 최소 1글자는 보장
            } else {
                hintLen = parseInt(hintOpt) || 1;
            }

            const hint = syn.slice(0, hintLen) + '_'.repeat(Math.max(0, syn.length - hintLen));

            const row = document.createElement('div');
            row.className = 'synonym-row';
            row.innerHTML = `
                <div class="hint-text">${hint.split('').join(' ')}</div>
                <div class="input-container">
                    <input type="text" class="quiz-answer-input" data-index="${index}" placeholder="정답 입력" onkeydown="handleKeyDown(event)">
                    <span class="feedback" id="feedback-${index}"></span>
                </div>
            `;
            container.appendChild(row);
        });

        const firstInput = container.querySelector('input');
        if (firstInput) firstInput.focus();
    }
}

function handleKeyDown(event) {
    if (event.key === 'Enter') {
        if (!isSubmitted) submitAnswer();
        else nextQuestion();
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
    if (nextBtn) { nextBtn.classList.remove('hidden'); nextBtn.focus(); }
}

function nextQuestion() {
    currentIdx++;
    showQuestion();
}

function exitQuiz() {
    if (confirm('테스트를 중단하시겠습니까? 푼 문항만 기록에 저장됩니다.')) showResult(true);
}

function saveQuizRecord(totalCount, correctCount) {
    try {
        const historyData = JSON.parse(localStorage.getItem('quizHistory') || '[]');
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
        
        historyData.unshift({
            date: dateStr,
            type: currentTestType,
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
    allWords.forEach(w => {
        if (!grouped[w.day]) grouped[w.day] = [];
        grouped[w.day].push(w);
    });

    let html = '';
    Object.keys(grouped).sort((a, b) => Number(a) - Number(b)).forEach(day => {
        html += `<div class="day-section">`;
        html += `<h4 class="day-header">DAY ${day}</h4>`;
        grouped[day].forEach(w => {
            html += `
                <div class="word-item">
                    <strong>${w.word}</strong><span class="pos-tag">${w.pos}</span>
                    <span class="syn-list">${w.synonyms.join(', ')}</span>
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

function showSetupView() {
    navigateTo('setup-screen');
}

function toggleDarkMode() {
    const current = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
}