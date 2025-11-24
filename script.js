const questionPath = './questions.json';

const questionsPromise = fetch(questionPath).then(response => response.json());

const passDefaultMsg = "Your patient has demonstrated an ability to communicate a choice, understand the relavant information, appreciate the situation and its consequences, and identify rational reasoning for making their decisions. Therefore, to a reasonable degree of medical certainty, your patient has the capacity to make decisions with informed consent."
const failDefaultMsg = "Your patient cannot make a reasoned decision about their medical treatment."

questionHistory = [];
questionViewIndex = 0;
answerNodeCache = {
    index: -1,
    answer: -1,
    notes: ''
}

function saveAnswersJson() {
    answerNodeCache.notes = document.getElementById('answerInput').value;
    const JSONBlob = {
        answerHistory: questionHistory,
        currentAnswer: answerNodeCache
    }
    const answersJson = JSON.stringify(JSONBlob, null, 2);
    return answersJson;
}

function loadAnswersJson(inputJson) {
    const JSONBlob = JSON.parse(inputJson);
    questionHistory = JSONBlob.answerHistory;
    answerNodeCache = JSONBlob.currentAnswer;
    questionViewIndex = questionHistory.length;
    updateQuestionView();
    updateAnswerView();
}

function downloadAnswersJson() {
    const answersJson = saveAnswersJson();
    const blob = new Blob([answersJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'answers.json';
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
}

function uploadAnswersJson(event) {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
        loadAnswersJson(e.target.result);
    }
    reader.readAsText(file);
}

function resetAnswers() {
    questionHistory = [];
    answerNodeCache = {
        index: -1,
        answer: -1,
        notes: ''
    }
    questionViewIndex = 0;
    document.getElementById('answerInput').value = '';
    document.getElementById('answerText').querySelectorAll('p').forEach(n => n.remove());
    document.getElementById('answerText').classList.remove('pass', 'fail');
    document.getElementById('answerDisplay').classList.remove('show', 'pass', 'fail');
    document.querySelector('.button-group').querySelectorAll('.btn').forEach(btn => btn.disabled = false)
    updateQuestionView();
    updateAnswerView();
}

async function submitAnswer() {
    const questions = (await questionsPromise).questions;
    const answerDisplay = document.getElementById('answerDisplay');
    const answerText = document.getElementById('answerText');

    switch(answerNodeCache.answer) {
        case 0:
            nextIndex = questions[answerNodeCache.index].yes ?? -1;
            break;
        case 1:
            nextIndex = questions[answerNodeCache.index].no ?? -1;
            break;
        default:
            nextIndex = questions[answerNodeCache.index].maybe ?? -1;
            break;
    }
    answerNodeCache.notes = document.getElementById('answerInput').value;
    if (nextIndex === true) {
        // Create <p> element and prepend it
        const p = document.createElement('p');
        p.textContent = questions[answerNodeCache.index].passMsg ?? passDefaultMsg;
        // Remove all existing <p> inside answerText
        answerText.querySelectorAll('p').forEach(n => n.remove());
        answerText.prepend(p);
        answerText.classList.add('pass');
        answerDisplay.classList.add('pass', 'show');
        document.querySelector('.btn.btn-nav[onclick*="viewNext"]').disabled = true;
        document.querySelector('.button-group').querySelectorAll('.btn').forEach(btn => btn.disabled = true);
    } else if (nextIndex === false) {
        // Create <p> element and prepend it
        const p = document.createElement('p');
        p.textContent = questions[answerNodeCache.index].failMsg ?? failDefaultMsg;
        // Remove all existing <p> inside answerText
        answerText.querySelectorAll('p').forEach(n => n.remove());
        answerText.prepend(p);
        answerText.classList.add('fail');
        answerDisplay.classList.add('fail', 'show');
        document.querySelector('.btn.btn-nav[onclick*="viewNext"]').disabled = true;
        document.querySelector('.button-group').querySelectorAll('.btn').forEach(btn => btn.disabled = true);
    } else if (nextIndex === -1) {
        alert('Error: tree behavior not implemented.');
    } else {
        questionHistory.push(answerNodeCache);
        answerNodeCache = {
            index: nextIndex,
            answer: -1,
            notes: ''
        }
        questionViewIndex = questionHistory.length;
        await updateQuestionView();
        updateAnswerView();
    }
}

async function updateQuestionView() {
    const questions = (await questionsPromise).questions;
    const questionElement = document.querySelector('.question');
    const answerDisplay = document.getElementById('answerDisplay');
    const answerInput = document.getElementById('answerInput');

    if (answerNodeCache.index === -1) {
        answerNodeCache.index = (await questionsPromise).startIndex;
    }
    
    // Hide current answer
    answerDisplay.classList.remove('show', 'pass', 'fail');

    // Update notes input
    answerInput.value = questionViewIndex >= questionHistory.length ? answerNodeCache.notes : questionHistory[questionViewIndex].notes;

    // Disable prev button if at beginning
    const prevBtn = document.querySelector('.btn.btn-nav[onclick*="viewPrevious"]');
    if (prevBtn) {
        prevBtn.disabled = (questionViewIndex === 0);
    }

    // Disable next button if at end
    const nextBtn = document.querySelector('.btn.btn-nav[onclick*="viewNext"]');
    if (nextBtn) {
        nextBtn.disabled = (questionViewIndex > questionHistory.length) || (questionViewIndex == questionHistory.length && answerNodeCache.answer == -1);
    }
    // Get next question
    questionElement.innerHTML = '';
    questions[questionViewIndex >= questionHistory.length ? answerNodeCache.index : questionHistory[questionViewIndex].index].question.forEach(question => {
        questionElement.appendChild(document.createElement('br'));
        questionElement.lastChild.after(question);
    });
    questionElement.removeChild(questionElement.firstChild);
    
    // Add animation
    questionElement.style.opacity = '0';
    setTimeout(() => {
        questionElement.style.opacity = '1';
    }, 200);
}

function updateAnswerView() {
    document.querySelector('.button-group').querySelectorAll('.btn').forEach(btn => btn.classList.remove('btn-selected'));
    switch (questionViewIndex >= questionHistory.length ? answerNodeCache.answer : questionHistory[questionViewIndex].answer) {
        case 0:
            document.querySelector('.btn-yes').classList.add('btn-selected');
            break;
        case 1:
            document.querySelector('.btn-no').classList.add('btn-selected');
            break;
        case 2:
            document.querySelector('.btn-maybe').classList.add('btn-selected');
            break;
        default:
            document.querySelector('.btn.btn-nav[onclick*="viewNext"]').disabled = true;
    }
}

async function viewNext() {
    if (questionViewIndex > questionHistory.length) {
        return false;
    }
    if (questionViewIndex == questionHistory.length && answerNodeCache.answer != -1) {
        submitAnswer();
        return true;
    }
    questionHistory[questionViewIndex].notes = document.getElementById('answerInput').value;
    questionViewIndex++;
    await updateQuestionView();
    updateAnswerView();
    return true;
}

async function viewPrevious() {
    if (questionViewIndex <= 0) {
        return false;
    }
    if (questionViewIndex < questionHistory.length) {
        questionHistory[questionViewIndex].notes = document.getElementById('answerInput').value;
    } else {
        answerNodeCache.notes = document.getElementById('answerInput').value;
    }
    questionViewIndex--;
    await updateQuestionView();
    updateAnswerView();
    document.querySelector('.button-group').querySelectorAll('.btn').forEach(btn => btn.disabled = false)
    return true;
}

function selectAnswer(answerIndex) {
    viewAnswer = questionViewIndex >= questionHistory.length ? answerNodeCache.answer : questionHistory[questionViewIndex].answer
    answerNodeCache.answer = viewAnswer == answerIndex ? -1 : answerIndex;
    if (questionViewIndex < questionHistory.length) {
        answerNodeCache.index = questionHistory[questionViewIndex].index;
        questionHistory = questionHistory.slice(0, questionViewIndex);
    }
    document.querySelector('.btn.btn-nav[onclick*="viewNext"]').disabled = false;
    updateAnswerView();
}

document.addEventListener('keydown', (event) => {
    if (document.activeElement === document.getElementById('answerInput')) {
        return;
    }
    if (event.key === 'ArrowLeft' && !document.getElementById('btn-prev').disabled) {
        viewPrevious();
    } else if ((event.key === 'ArrowRight' || event.key === 'Enter') && !document.getElementById('btn-next').disabled) {
        viewNext();
    }
});

updateQuestionView();