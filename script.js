const { jsPDF } = window.jspdf;

const questionPath = './questions.json';

const questionsPromise = fetch(questionPath).then(response => response.json());

const passDefaultMsg = "Your patient has demonstrated an ability to communicate a choice, understand the relavant information, appreciate the situation and its consequences, and identify rational reasoning for making their decisions. Therefore, to a reasonable degree of medical certainty, your patient has the capacity to make decisions with informed consent."
const failDefaultMsg = "Your patient cannot make a reasoned decision about their medical treatment."

patientName='';
questionHistory = [];
questionViewIndex = 0;
isCapable = -1;
answerNodeCache = {
    index: -1,
    answer: -1,
    notes: ''
}

function startAssessment() {
    if (document.getElementById('patientNameInput').value.trim() === "") {
        alert("Please enter the patient's name before starting the assessment.");
        return;
    }
    patientName = document.getElementById('patientNameInput').value;
    document.querySelector('.patient-name').textContent = "Patient: " + patientName;
    document.querySelector('.start-screen').setAttribute('hidden', true);
    document.querySelector('.main-screen').hidden = false;
}

function saveAnswersJson() {
    answerNodeCache.notes = document.getElementById('answerInput').value;
    const JSONBlob = {
        patientName: patientName,
        answerHistory: questionHistory,
        currentAnswer: answerNodeCache,
        isCapable: isCapable
    }
    const answersJson = JSON.stringify(JSONBlob, null, 2);
    return answersJson;
}

function loadAnswersJson(inputJson) {
    const JSONBlob = JSON.parse(inputJson);
    patientName = JSONBlob.patientName;
    questionHistory = JSONBlob.answerHistory;
    answerNodeCache = JSONBlob.currentAnswer;
    isCapable = JSONBlob.isCapable;
    questionViewIndex = questionHistory.length;
    document.querySelector('.patient-name').textContent = "Patient: " + patientName;
    updateQuestionView();
    updateAnswerView();
    document.querySelector('.start-screen').setAttribute('hidden', true);
    document.querySelector('.main-screen').hidden = false;
}

function downloadAnswersJson() {
    const answersJson = saveAnswersJson();
    const blob = new Blob([answersJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = patientName + ' - cappacity log.json';
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

async function downloadAnswersPdf() {
    const doc = new jsPDF();
    const questions = (await questionsPromise).questions;
    const answersJson = JSON.parse(saveAnswersJson());
    const downloadTxt = 
`Patient: ${answersJson.patientName}

Answers:
-\t${answersJson.answerHistory.map(answer => `Question: ${questions[answer.index].question}
\tAnswer: ${answer.answer == 0 ? 'Yes' : answer.answer == 1 ? 'No' : 'Maybe'}
\tNotes: ${answer.notes}`).join('\n\n')}

-\t${questions[answersJson.currentAnswer.index].question}
\tAnswer: ${answersJson.currentAnswer.answer == 0 ? 'Yes' : answersJson.currentAnswer.answer == 1 ? 'No' : 'Maybe'}
\tNotes: ${answersJson.currentAnswer.notes}

Patient is Capable? ${answersJson.isCapable == 1 ? 'Yes' : answersJson.isCapable == 0 ? 'No' : 'Unknown'}`;
    doc.text(downloadTxt, 10, 10, {maxWidth: 180});
    doc.save(patientName + ' - cappacity log.pdf');
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
    removeVerdict();
    document.querySelector('.button-group').querySelectorAll('.btn').forEach(btn => btn.disabled = false)
    updateQuestionView();
    updateAnswerView();
}

function removeVerdict() {
    document.getElementById('answerText').querySelectorAll('p').forEach(n => n.remove());
    document.getElementById('answerText').classList.remove('pass', 'fail');
    document.getElementById('answerDisplay').classList.remove('show', 'pass', 'fail');
}

async function renderVerdict(passed) {
    const questions = (await questionsPromise).questions;
    const answerText = document.getElementById('answerText');
    const answerDisplay = document.getElementById('answerDisplay');
    
    isCapable = passed ? 1 : 0;
    
    // Create <p> element and prepend it
    const p = document.createElement('p');
    if (passed) {
        p.textContent = questions[answerNodeCache.index].passMsg ?? passDefaultMsg;
    } else {
        p.textContent = questions[answerNodeCache.index].failMsg ?? failDefaultMsg;
    }
    // Remove all existing <p> inside answerText
    answerText.querySelectorAll('p').forEach(n => n.remove());
    answerText.prepend(p);
    
    // Add appropriate CSS classes
    if (passed) {
        answerText.classList.add('pass');
        answerDisplay.classList.add('pass', 'show');
    } else {
        answerText.classList.add('fail');
        answerDisplay.classList.add('fail', 'show');
    }
    
    // Disable navigation and answer buttons
    document.querySelector('.btn.btn-nav[onclick*="viewNext"]').disabled = true;
    document.querySelector('.button-group').querySelectorAll('.btn').forEach(btn => btn.disabled = true);
}

async function submitAnswer() {
    const questions = (await questionsPromise).questions;

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
        await renderVerdict(true);
    } else if (nextIndex === false) {
        await renderVerdict(false);
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
    const answerInput = document.getElementById('answerInput');

    if (answerNodeCache.index === -1) {
        answerNodeCache.index = (await questionsPromise).startIndex;
    }
    
    // Hide current answer
    removeVerdict();

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

    // Reset isCapable
    isCapable = -1;
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

document.getElementById('patientNameInput').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        startAssessment();
    }
});

updateQuestionView();