let allWords = [];
let quizWords = [];
let wrongWords = [];
let currentIdx = 0;
let score = 0;
let currentTargetSynonyms = [];

// 1. CSV 데이터 파싱 함수 (따옴표 및 공백 안정적으로 제거)
function parseCSV(text) {
    const lines = text.split(/\r?\n/);
    const result = [];
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // 콤마 분리 (단, 데이터 내 따옴표 처리 완화)
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

// 파일 자동 로드
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
        // 입력받은 DAY 파싱 (공백 제거)
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

    const q = quizWords[currentIdx];
    const hintLen = parseInt(document.getElementById('hint-count').value) || 2;
    const reqSynCount = parseInt(document.getElementById('synonym-count-input').value) || 1;

    document.getElementById('quiz-progress').innerText = `문제: ${currentIdx + 1} / ${quizWords.length}`;
    document.getElementById('quiz-word').innerText = q.word;
    document.getElementById('quiz-pos').innerText = q.pos;

    // 현재 문제에서 출제할 동의어 수 제한 개수만큼 가져오기
    currentTargetSynonyms = q.synonyms.slice(0, reqSynCount);

    const container = document.getElementById('inputs-container');
    container.innerHTML = '';

    // 설정된 동의어 개수만큼 각각 힌트와 입력 칸 생성
    currentTargetSynonyms.forEach((syn, index) => {
        const hint = syn.slice(0, hintLen) + '_'.repeat(Math.max(0, syn.length - hintLen));
        const hintFormatted = hint.split('').join(' ');

        const row = document.createElement('div');
        row.className = 'synonym-row';
        row.innerHTML = `
            <label>동의어 ${index + 1} 힌트: ${hintFormatted}</label>
            <input type="text" class="quiz-answer-input" data-index="${index}" placeholder="철자 입력" onkeydown="if(event.key==='Enter') submitAnswer()">
        `;
        container.appendChild(row);
    });

    // 첫 번째 입력창에 포커스
    const firstInput = container.querySelector('input');
    if (firstInput) firstInput.focus();

    document.getElementById('quiz-result').innerText = '';
}

function submitAnswer() {
    // 이미 채점되어 대기 중일 때는 중복 실행 방지
    if (document.getElementById('quiz-result').innerText !== '') return;

    const inputElements = document.querySelectorAll('.quiz-answer-input');
    let allCorrect = true;
    let wrongDetails = [];

    inputElements.forEach(inputEl => {
        const idx = parseInt(inputEl.getAttribute('data-index'));
        const userAns = inputEl.value.trim().toLowerCase();
        const correctAns = currentTargetSynonyms[idx].toLowerCase();

        if (userAns !== correctAns) {
            allCorrect = false;
        }
    });

    const resultEl = document.getElementById('quiz-result');
    const q = quizWords[currentIdx];

    if (allCorrect) {
        score++;
        resultEl.className = 'result-message correct';
        resultEl.innerText = '⭕ 정답입니다!';
    } else {
        // 하나라도 틀리면 오답 처리 및 현재 단어를 오답 노트에 추가
        if (!wrongWords.some(w => w.word === q.word)) {
            wrongWords.push(q);
        }
        resultEl.className = 'result-message wrong';
        resultEl.innerText = `❌ 오답!\n요청 정답: ${currentTargetSynonyms.join(', ')}`;
    }

    localStorage.setItem('wrongWords', JSON.stringify(wrongWords));

    // 1.8초 후 다음 문제로 이동
    setTimeout(() => {
        currentIdx++;
        showQuestion();
    }, 1800);
}

function showResult() {
    showScreen('result-screen');
    document.getElementById('result-score').innerText = `${quizWords.length}문제 중 ${score}문제 맞추셨습니다.`;
    checkWrongHistory();
}

function viewWordList() {
    showScreen('wordlist-screen');
    const content = document.getElementById('wordlist-content');
    
    if (allWords.length === 0) {
        content.innerHTML = '<p>불러온 단어가 없습니다. data.csv 파일을 확인해주세요.</p>';
        return;
    }

    content.innerHTML = allWords.map(w => `
        <div class="word-item">
            <strong>DAY ${w.day} - ${w.word}</strong> (${w.pos})<br>
            <span style="color: var(--secondary)">동의어: ${w.synonyms.join(', ')}</span>
        </div>
    `).join('');
}

function showSetupView() {
    showScreen('setup-screen');
    checkWrongHistory();
}

function showScreen(id) {
    ['setup-screen', 'quiz-screen', 'result-screen', 'wordlist-screen'].forEach(s => {
        document.getElementById(s).classList.add('hidden');
    });
    document.getElementById(id).classList.remove('hidden');
}

function toggleDarkMode() {
    const current = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
}