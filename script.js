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
    const saved = localStorage.getItem('wrongWords');
    if (saved) {
        wrongWords = JSON.parse(saved);
        const retryBtn = document.getElementById('retry-btn');
        if (wrongWords.length > 0) {
            retryBtn.classList.remove('hidden');
        } else {
            retryBtn.classList.add('hidden');
        }
    }
}

function startTest(isRetry) {
    let pool = isRetry ? [...wrongWords] : [...allWords];
    
    if (!isRetry) {
        const targetDays = document.getElementById('day-input').value.split(',').map(d => d.trim());
        pool = pool.filter(w => targetDays.includes(w.day));
    }

    if (pool.length === 0) {
        alert('해당하는 DAY의 단어가 없거나 데이터를 불러오지 못했습니다.');
        return;
    }

    if (document.getElementById('shuffle-input').checked) {
        pool.sort(() => Math.random() - 0.5);
    }

    const count = parseInt(document.getElementById('quiz-count').value) || 10;
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
    document.getElementById('submit-btn').classList.remove('hidden');
    document.getElementById('next-btn').classList.add('hidden');

    const q = quizWords[currentIdx];
    const hintLen = parseInt(document.getElementById('hint-count').value) || 2;
    const reqSynCount = parseInt(document.getElementById('synonym-count-input').value) || 1;

    document.getElementById('quiz-progress').innerText = `문제: ${currentIdx + 1} / ${quizWords.length}`;
    document.getElementById('quiz-word').innerText = q.word;
    document.getElementById('quiz-pos').innerText = q.pos;

    currentTargetSynonyms = q.synonyms.slice(0, reqSynCount);

    const container = document.getElementById('inputs-container');
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
        const correctAns = currentTargetSynonyms[idx].toLowerCase();
        const feedbackEl = document.getElementById(`feedback-${idx}`);

        inputEl.disabled = true;

        if (userAns === correctAns) {
            feedbackEl.className = 'feedback correct';
            feedbackEl.innerText = '⭕ 정답';
        } else {
            allCorrect = false;
            feedbackEl.className = 'feedback wrong';
            feedbackEl.innerText = `❌ 오답 (정답: ${currentTargetSynonyms[idx]})`;
        }
    });

    const q = quizWords[currentIdx];
    if (allCorrect) {
        score++;
    } else {
        if (!wrongWords.some(w => w.word === q.word)) {
            wrongWords.push(q);
        }
    }

    localStorage.setItem('wrongWords', JSON.stringify(wrongWords));
    
    isSubmitted = true;
    document.getElementById('submit-btn').classList.add('hidden');
    document.getElementById('next-btn').classList.remove('hidden');
    document.getElementById('next-btn').focus();
}

function nextQuestion() {
    currentIdx++;
    showQuestion();
}

// 중도 종료 기능 (푼 문항만 계산하여 기록 저장)
function exitQuiz() {
    if (confirm('테스트를 중단하시겠습니까? 현재까지 푼 문항만 기록에 반영됩니다.')) {
        showResult(true); 
    }
}

function saveQuizRecord(totalCount, correctCount) {
    const history = JSON.parse(localStorage.getItem('quizHistory') || '[]');
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    
    history.unshift({
        date: dateStr,
        total: totalCount,
        correct: correctCount
    });
    
    localStorage.setItem('quizHistory', JSON.stringify(history));
}

function showResult(isInterrupted = false) {
    showScreen('result-screen');
    // 중단 시 현재 번호 전까지를 전체 개수로 판단 (단, 제출 완료 안 한 문제는 문항 수에서 제외)
    const totalAttempted = isInterrupted ? (isSubmitted ? currentIdx + 1 : currentIdx) : quizWords.length;
    
    document.getElementById('result-score').innerText = isInterrupted 
        ? `테스트가 중단되었습니다.\n푼 문제: ${totalAttempted}문제 중 ${score}문제 맞춤`
        : `테스트 완료!\n총 ${totalAttempted}문제 중 ${score}문제 맞추셨습니다.`;
        
    if (totalAttempted > 0) {
        saveQuizRecord(totalAttempted, score);
    }
    checkWrongHistory();
}

// DAY별 그룹화하여 단어장 출력하는 기능
function viewWordList() {
    showScreen('wordlist-screen');
    const content = document.getElementById('wordlist-content');
    
    if (allWords.length === 0) {
        content.innerHTML = '<p>불러온 단어가 없습니다. data.csv 파일을 확인해주세요.</p>';
        return;
    }

    // DAY 기준으로 데이터 묶기
    const grouped = {};
    allWords.forEach(w => {
        if (!grouped[w.day]) grouped[w.day] = [];
        grouped[w.day].push(w);
    });

    let html = '';
    // DAY 정렬 정렬 후 화면 출력 생성
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
    const history = JSON.parse(localStorage.getItem('quizHistory') || '[]');

    if (history.length === 0) {
        content.innerHTML = '<p>저장된 테스트 기록이 없습니다.</p>';
        return;
    }

    content.innerHTML = history.map(h => `
        <div class="history-item">
            <strong>일시:</strong> ${h.date}<br>
            <strong>결과:</strong> ${h.total}문제 중 ${h.correct}문제 정답 (${Math.round((h.correct/h.total)*100)}%)
        </div>
    `).join('');
}

function clearHistory() {
    if (confirm('모든 테스트 기록을 삭제하시겠습니까?')) {
        localStorage.removeItem('quizHistory');
        viewHistory();
    }
}

function showSetupView() {
    showScreen('setup-screen');
    checkWrongHistory();
}

function showScreen(id) {
    ['setup-screen', 'quiz-screen', 'result-screen', 'wordlist-screen', 'history-screen'].forEach(s => {
        document.getElementById(s).classList.add('hidden');
    });
    document.getElementById(id).classList.remove('hidden');
}

function toggleDarkMode() {
    const current = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
}