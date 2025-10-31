const questionPath = './questions.json';

const questionsPromise = fetch(questionPath).then(response => response.json());

const passDefaultMsg = "Your patient has demonstrated an ability to communicate a choice, understand the relavant information, appreciate the situation and its consequences, and identify rational reasoning for making their decisions. Therefore, to a reasonable degree of medical certainty, your patient has the capacity to make decisions with informed consent."
const failDefaultMsg = "Your patient cannot make a reasoned decision about their medical treatment."

currentQuestionIndex = -1;

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
        document.querySelectorAll('.btn').forEach(btn => btn.disabled = true);
    } else if (nextIndex === false) {
        answerText.textContent = questions[currentQuestionIndex].failMsg ?? failDefaultMsg;
        answerText.classList.add('fail');
        answerDisplay.classList.add('fail');
        answerDisplay.classList.add('show');
        document.querySelectorAll('.btn').forEach(btn => btn.disabled = true);
    } else if (nextIndex === -1) {
        alert('Error: tree behavior not implemented.');
    } else {
        currentQuestionIndex = nextIndex;
        getNewQuestion();
    }
}

async function getNewQuestion() {
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
    
    // Get next question
    questionElement.innerHTML = '';
    questions[currentQuestionIndex].question.forEach(question => {
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

getNewQuestion();