const questions = [
    {//Q1
        question: "Is your patient able to communicate a choice? (Is your patient able to respond to you and express a decision?)",
        yes: 1,
        no: 2,
        maybe: 3
    },
    {//R1A-Q2
        question: "Is your patient able to communicate a choice? (Is your patient able to respond to you and express a decision?)",
        yes: true,
        no: 3,
        maybe: 3
    },
    {//R1B-Q2
        question: "Patients without an ability to communicate do not have capacity for making medical decisions. Would you like to continue evaluating patient's potential capacity (Two examples of a patient being unable to communicate would be if the patient is unable to respond or unconsious. Please evaluate for alternative modes of commiunication if possible)?",
        yes: 3,
        no: false,
        maybe: -1
    },
    {//R1C-Q2
        question: "Please ask your patient the following questions:\n\t- Have you decided whether to follow your doctor’s [or my] recommendation for treatment?\n\t- Can you tell me what that decision is?\n\t- [If no decision] What is making it hard for you to decide?\nWas the patient able to appropriately answer the questions above?",
        yes: 4,
        no: false,
        maybe: -1
    },
    {//R1C-R2A-Q3
        question: "Can your patient adequately answer the following questions: What did your doctor [or I] tell you about:\n\ta) The problem with your health now\n\tb) The recommended treatment\n\tc) The possible benefits and risks (or discomforts) of the treatment\n\td) Any alternative treatments and their risks and benefits\n\te) The risks and benefits of no treatment",
        yes: 5,
        no: false,
        maybe: -1
    },
    {//R1C-R2A-R3A-Q4
        question: "Is your patient able to describe their understanding of their medical condition, proposed treatment, and likely outcomes by answering the following questions:\n\t- What do you believe is wrong with your health now?\n\t- Do you believe that you need some kind of treatment?\n\t- What is treatment likely to do for you?\n\t- What makes you believe it will have that effect?\n\t- What do you believe will happen if you are not treated?\n\t- Why do you think your doctor has [or I have] recommended this treatment?",
        yes: 6,
        no: false,
        maybe: -1
    },
    {//R1C-R2A-R3A-R4A-Q5
        question: "Can your patient engage in a rational process of manipulating the relevant information by answering the following questions:\n\t- How did you decide to accept or reject the recommended treatment?\n\t- What makes [chosen option] better than [alternative option]?",
        yes: true,
        no: false,
        maybe: -1
    },
];

const yesCapacity = "Your patient has demonstrated an ability to communicate a choice, understand the relavant information, appreciate the situation and its consequences, and identify rational reasoning for making their decisions. Therefore, to a reasonable degree of medical certainty, your patient has the capacity to make decisions with informed consent."
const noCapacity = "Your patient cannot make a reasoned decision about their medical treatment."

let currentQuestionIndex = 0;

function submitAnswer(answerIndex) {
    const answerDisplay = document.getElementById('answerDisplay');
    const answerText = document.getElementById('answerText');

    switch(answerIndex) {
        case 0:
            nextIndex = questions[currentQuestionIndex].yes;
            break;
        case 1:
            nextIndex = questions[currentQuestionIndex].no;
            break;
        default:
            nextIndex = questions[currentQuestionIndex].maybe;
            break;
    }
    if (nextIndex === true) {
        answerText.textContent = yesCapacity;
        answerDisplay.classList.add('show');
        document.querySelectorAll('.btn').forEach(btn => btn.disabled = true);
    } else if (nextIndex === false) {
        answerText.textContent = noCapacity;
        answerDisplay.classList.add('show');
        document.querySelectorAll('.btn').forEach(btn => btn.disabled = true);
    } else if (nextIndex === -1) {
        alert('Error: tree behavior not implemented.');
    } else {
        currentQuestionIndex = nextIndex;
        getNewQuestion();
    }
}

function getNewQuestion() {
    const questionElement = document.querySelector('.question');
    const answerDisplay = document.getElementById('answerDisplay');
    const answerInput = document.getElementById('answerInput');
    
    // Hide current answer
    answerDisplay.classList.remove('show');
    
    // Clear input
    answerInput.value = '';
    
    // Get next question
    questionElement.textContent = questions[currentQuestionIndex].question;
    
    // Add animation
    questionElement.style.opacity = '0';
    setTimeout(() => {
        questionElement.style.opacity = '1';
    }, 200);
}

getNewQuestion();