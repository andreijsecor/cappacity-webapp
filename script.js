const questionPath = './questions.json';

const questionsPromise = fetch(questionPath).then(response => response.json());

const passDefaultMsg = "Your patient has demonstrated an ability to communicate a choice, understand the relavant information, appreciate the situation and its consequences, and identify rational reasoning for making their decisions. Therefore, to a reasonable degree of medical certainty, your patient has the capacity to make decisions with informed consent."
const failDefaultMsg = "Your patient cannot make a reasoned decision about their medical treatment."

currentQuestionIndex = -1;
questionHistory = [];
questionViewIndex = 0;
currentAnswerIndex = -1;

async function submitAnswer(answerIndex) {
    const questions = (await questionsPromise).questions;
    const answerDisplay = document.getElementById('answerDisplay');
    const answerText = document.getElementById('answerText');

    switch(answerIndex) {
        case 0:
            nextIndex = questions[currentQuestionIndex].yes ?? -1;
            break;
        case 1:
            nextIndex = questions[currentQuestionIndex].no ?? -1;
            break;
        default:
            nextIndex = questions[currentQuestionIndex].maybe ?? -1;
            break;
    }
    if (nextIndex === true) {
        answerText.textContent = questions[currentQuestionIndex].passMsg ?? passDefaultMsg;
        answerText.classList.add('pass');
        answerDisplay.classList.add('pass');
        answerDisplay.classList.add('show');
        document.querySelector('.btn.btn-nav[onclick*="viewNext"]').disabled = true;
        document.querySelector('.button-group').querySelectorAll('.btn').forEach(btn => btn.disabled = true);
    } else if (nextIndex === false) {
        answerText.textContent = questions[currentQuestionIndex].failMsg ?? failDefaultMsg;
        answerText.classList.add('fail');
        answerDisplay.classList.add('fail');
        answerDisplay.classList.add('show');
        document.querySelector('.btn.btn-nav[onclick*="viewNext"]').disabled = true;
        document.querySelector('.button-group').querySelectorAll('.btn').forEach(btn => btn.disabled = true);
    } else if (nextIndex === -1) {
        alert('Error: tree behavior not implemented.');
    } else {
        questionHistory.push({
            index: currentQuestionIndex,
            answer: answerIndex
        });
        currentQuestionIndex = nextIndex;
        questionViewIndex = questionHistory.length;
        currentAnswerIndex = -1;
        await updateQuestionView();
        updateAnswerView();
    }
}

async function updateQuestionView() {
    const questions = (await questionsPromise).questions;
    const questionElement = document.querySelector('.question');
    const answerDisplay = document.getElementById('answerDisplay');
    const answerInput = document.getElementById('answerInput');

    if (currentQuestionIndex === -1) {
        currentQuestionIndex = (await questionsPromise).startIndex;
    }
    
    // Hide current answer
    answerDisplay.classList.remove('show');
    
    // Clear input
    answerInput.value = '';

    // Disable prev button if at beginning
    const prevBtn = document.querySelector('.btn.btn-nav[onclick*="viewPrevious"]');
    if (prevBtn) {
        prevBtn.disabled = (questionViewIndex === 0);
    }

    // Disable next button if at end
    const nextBtn = document.querySelector('.btn.btn-nav[onclick*="viewNext"]');
    if (nextBtn) {
        nextBtn.disabled = (questionViewIndex > questionHistory.length) || (questionViewIndex == questionHistory.length && currentAnswerIndex == -1);
    }
    // Get next question
    questionElement.innerHTML = '';
    questions[questionViewIndex >= questionHistory.length ? currentQuestionIndex : questionHistory[questionViewIndex].index].question.forEach(question => {
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
    switch (questionViewIndex >= questionHistory.length ? currentAnswerIndex : questionHistory[questionViewIndex].answer) {
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
    if (questionViewIndex == questionHistory.length && currentAnswerIndex != -1) {
        submitAnswer(currentAnswerIndex);
        return true;
    }
    questionViewIndex++;
    await updateQuestionView();
    updateAnswerView();
    return true;
}

async function viewPrevious() {
    if (questionViewIndex <= 0) {
        return false;
    }
    questionViewIndex--;
    await updateQuestionView();
    updateAnswerView();
    document.querySelector('.button-group').querySelectorAll('.btn').forEach(btn => btn.disabled = false)
    return true;
}

function selectAnswer(answerIndex) {
    viewAnswer = questionViewIndex >= questionHistory.length ? currentAnswerIndex : questionHistory[questionViewIndex].answer
    currentAnswerIndex = viewAnswer == answerIndex ? -1 : answerIndex;
    if (questionViewIndex < questionHistory.length) {
        currentQuestionIndex = questionHistory[questionViewIndex].index;
        questionHistory = questionHistory.slice(0, questionViewIndex);
    }
    document.querySelector('.btn.btn-nav[onclick*="viewNext"]').disabled = false;
    updateAnswerView();
}

updateQuestionView();