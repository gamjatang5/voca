let allWords = [];
let quizWords = [];
let wrongWords = [];
let currentIdx = 0;
let score = 0;
let currentTargetSynonyms = [];
let isSubmitted = false;

function parseCSV(text) {
    const lines = text.split(/\r?\n/);
    const result = [];
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = line.split(',').map(item => item.replace(/^["']|["']$/g, '').trim());
        
        if (parts.length >= 3) {
            const synonyms = parts.slice(3).filter(Boolean);
            result.push({
                day: parts[0],
                word: parts[1],
                pos: parts[2],
                synonyms: synonyms
            });
        }
    }
    return result;
}

fetch('data.csv')
    .then(res => {
        if (!res.ok) throw new Error('data.csv 파일을 찾을 수 없습니다.');
        return res.text();
    })
    .then(text => {
        allWords = parseCSV(text);
        checkWrongHistory();
    })
    .catch(err => {
        alert(err.message + '\nindex.html과 같은 폴더에 data.csv가 있는지 확인해주세요.');
    });

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
    } catch (e) {
        console.error(e);
    }
}

function startTest(isRetry) {
    let pool = isRetry ? [...wrongWords] : [...allWords];
    
    if (!isRetry) {
        const dayInput = document.getElementById('day-input');
        const targetDays = dayInput ? dayInput.value.split(',').map(d => d.trim()) : ["1"];
        pool = pool.filter(w => targetDays.includes(w.day));
    }

    if (pool.length === 0) {
        alert('해당하는 DAY의 단어가 없거나 데이터를 불러오지 못했습니다.');
        return;
    }

    const shuffleInput = document.getElementById('shuffle-input');
    if (shuffleInput && shuffleInput.checked) {
        pool.sort(() => Math.random() - 0.5);
    }

    const quizCountInput = document.getElementById('quiz-count');
    const count = quizCountInput ? (parseInt(quizCountInput.value) || 10) : 10;
    quizWords = pool.slice(0, count);
    currentIdx = 0;
    score = 0;
    if (!isRetry) wrongWords = [];

    showScreen('quiz-screen');
    showQuestion();
}

function showQuestion() {
    if (currentIdx >= quizWords.length) return showResult();

    isSubmitted = false;
    const submitBtn = document.getElementById('submit-btn');
    const nextBtn = document.getElementById('next-btn');
    if (submitBtn) submitBtn.classList.remove('hidden');
    if (nextBtn) nextBtn.classList.add('hidden');

    const q = quizWords[currentIdx];
    const hintCountInput = document.getElementById('hint-count');
    const synonymCountInput = document.getElementById('synonym-count-input');
    
    const hintLen = hintCountInput ? (parseInt(hintCountInput.value) || 2) : 2;
    const reqSynCount = synonymCountInput ? (parseInt(synonymCountInput.value) || 1) : 1;

    const progressEl = document.getElementById('quiz-progress');
    const wordEl = document.getElementById('quiz-word');
    const posEl = document.getElementById('quiz-pos');

    if (progressEl) progressEl.innerText = `문제: ${currentIdx + 1} / ${quizWords.length}`;
    if (wordEl) wordEl.innerText = q.word;
    if (posEl) posEl.innerText = q.pos;

    currentTargetSynonyms = q.synonyms.slice(0, reqSynCount);

    const container = document.getElementById('inputs-container');
    if (container) {
        container.innerHTML = '';
        currentTargetSynonyms.forEach((syn, index) => {
            const hint = syn.slice(0, hintLen) + '_'.repeat(Math.max(0, syn.length - hintLen));
            const hintFormatted = hint.split('').join(' ');

            const row = document.createElement('div');
            row.className = 'synonym-row';
            row.innerHTML = `
                <label>동의어 ${index + 1} 힌트: ${hintFormatted}</label>
                <div class="input-container">
                    <input type="text" class="quiz-answer-input" data-index="${index}" placeholder="철자 입력" onkeydown="handleKeyDown(event)">
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
                feedbackEl.innerText = '⭕ 정답';
            } else {
                allCorrect = false;
                feedbackEl.className = 'feedback wrong';
                feedbackEl.innerText = `❌ 오답 (정답: ${currentTargetSynonyms[idx] || ''})`;
            }
        }
    });

    const q = quizWords[currentIdx];
    if (allCorrect) {
        score++;
    } else {
        if (q && !wrongWords.some(w => w.word === q.word)) {
            wrongWords.push(q);
        }
    }

    try {
        localStorage.setItem('wrongWords', JSON.stringify(wrongWords));
    } catch (e) {
        console.error(e);
    }
    
    isSubmitted = true;
    const submitBtn = document.getElementById('submit-btn');
    const nextBtn = document.getElementById('next-btn');
    if (submitBtn) submitBtn.classList.add('hidden');
    if (nextBtn) {
        nextBtn.classList.remove('hidden');
        nextBtn.focus();
    }
}

function nextQuestion() {
    currentIdx++;
    showQuestion();
}

function exitQuiz() {
    if (confirm('테스트를 중단하시겠습니까? 현재까지 푼 문항만 기록에 반영됩니다.')) {
        showResult(true); 
    }
}

function saveQuizRecord(totalCount, correctCount) {
    try {
        const history = JSON.parse(localStorage.getItem('quizHistory') || '[]');
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
        
        history.unshift({
            date: dateStr,
            total: totalCount,
            correct: correctCount
        });
        
        localStorage.setItem('quizHistory', JSON.stringify(history));
    } catch (e) {
        console.error(e);
    }
}

function showResult(isInterrupted = false) {
    showScreen('result-screen');
    const totalAttempted = isInterrupted ? (isSubmitted ? currentIdx + 1 : currentIdx) : (quizWords ? quizWords.length : 0);
    
    const scoreEl = document.getElementById('result-score');
    if (scoreEl) {
        scoreEl.innerText = isInterrupted 
            ? `테스트가 중단되었습니다.\n푼 문제: ${totalAttempted}문제 중 ${score}문제 맞춤`
            : `테스트 완료!\n총 ${totalAttempted}문제 중 ${score}문제 맞추셨습니다.`;
    }
        
    if (totalAttempted > 0) {
        saveQuizRecord(totalAttempted, score);
    }
    checkWrongHistory();
}

function viewWordList() {
    showScreen('wordlist-screen');
    const content = document.getElementById('wordlist-content');
    if (!content) return;
    
    if (allWords.length === 0) {
        content.innerHTML = '<p>불러온 단어가 없습니다. data.csv 파일을 확인해주세요.</p>';
        return;
    }

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
                    <strong>${w.word}</strong> (${w.pos})<br>
                    <span style="color: var(--secondary)">동의어: ${w.synonyms.join(', ')}</span>
                </div>
            `;
        });
        html += `</div>`;
    });

    content.innerHTML = html;
}

function viewHistory() {
    showScreen('history-screen');
    const content = document.getElementById('history-content');
    if (!content) return;

    let history = [];
    try {
        history = JSON.parse(localStorage.getItem('quizHistory') || '[]');
    } catch (e) {
        console.error(e);
    }

    if (history.length === 0) {
        content.innerHTML = '<p>저장된 테스트 기록이 없습니다.</p>';
        return;
    }

    content.innerHTML = history.map(h => `
        <div class="history-item">
            <strong>일시:</strong> ${h.date || ''}<br>
            <strong>결과:</strong> ${h.total || 0}문제 중 ${h.correct || 0}문제 정답 (${h.total ? Math.round((h.correct/h.total)*100) : 0}%)
        </div>
    `).join('');
}

function clearHistory() {
    if (confirm('모든 테스트 기록을 삭제하시겠습니까?')) {
        try {
            localStorage.removeItem('quizHistory');
        } catch (e) {
            console.error(e);
        }
        viewHistory();
    }
}

function showSetupView() {
    showScreen('setup-screen');
    checkWrongHistory();
}

function showScreen(id) {
    const screens = ['setup-screen', 'quiz-screen', 'result-screen', 'wordlist-screen', 'history-screen'];
    screens.forEach(s => {
        const el = document.getElementById(s);
        if (el) el.classList.add('hidden');
    });
    const target = document.getElementById(id);
    if (target) target.classList.remove('hidden');
}

function toggleDarkMode() {
    const current = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
}