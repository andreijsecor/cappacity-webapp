const { jsPDF } = window.jspdf;

const questionPath = './questions.json';

const questionsPromise = fetch(questionPath).then(response => response.json());

const passDefaultMsg = "Your patient has demonstrated an ability to communicate a choice, understand the relavant information, appreciate the situation and its consequences, and identify rational reasoning for making their decisions. Therefore, to a reasonable degree of medical certainty, your patient has the capacity to make decisions with informed consent."
const failDefaultMsg = "Your patient cannot make a reasoned decision about their medical treatment."

const PDF_INK = '#252525';
const PDF_TITLE = '#667eea';
const PDF_YES = '#4d7a5c';
const PDF_NO = '#a35f5f';
const PDF_MAYBE = '#666666';

/** Guiding follow-ups appended by `questionToPlainLines` (parsed for PDF coloring). */
const PDF_GUIDING_SUFFIX_YES = ' [yes]';
const PDF_GUIDING_SUFFIX_NO = ' [no]';

/** @param {string|{text: string, yesNo?: boolean}} item */
function normalizeGuidingItem(item) {
    if (typeof item === 'string') {
        return { text: item, yesNo: false };
    }
    return { text: item.text, yesNo: Boolean(item.yesNo) };
}

/** @param {object} q @param {Record<string, number>|undefined} guidingAnswers 0=yes, 1=no */
function questionToPlainLines(q, guidingAnswers) {
    const ga = guidingAnswers && typeof guidingAnswers === 'object' ? guidingAnswers : {};
    const lines = [q.mainQuestion.text];
    q.guiding.forEach((block, bi) => {
        lines.push(block.heading);
        block.items.forEach((item, ii) => {
            const { text, yesNo } = normalizeGuidingItem(item);
            const key = `${bi}-${ii}`;
            let line = `- ${text}`;
            if (yesNo) {
                const v = ga[key];
                if (v === 0) {
                    line += PDF_GUIDING_SUFFIX_YES;
                } else if (v === 1) {
                    line += PDF_GUIDING_SUFFIX_NO;
                }
            }
            lines.push(line);
        });
    });
    return lines;
}

/** @param {object} node */
function ensureGuidingAnswers(node) {
    if (!node.guidingAnswers || typeof node.guidingAnswers !== 'object') {
        node.guidingAnswers = {};
    }
}

/**
 * One wrapped row for PDF: draw left-to-right with per-segment colors (jsPDF basics).
 * @param {{ text: string, color: string }[][]} rows
 * @returns {number} y-coordinate just below the last row (next baseline would be here + spacing if desired)
 */
function pdfDrawTextRows(doc, rows, x, y0, lineHeight) {
    let y = y0;
    for (const row of rows) {
        let xCursor = x;
        for (const seg of row) {
            doc.setTextColor(seg.color);
            doc.text(seg.text, xCursor, y);
            xCursor += doc.getTextWidth(seg.text);
        }
        y += lineHeight;
    }
    return y;
}

/**
 * Split one logical string into wrapped rows; optional trailing guiding suffix is its own colored tail
 * (same idea as drawing "Answer: " then a colored YES/NO).
 * @returns {{ text: string, color: string }[][]}
 */
function pdfBuildWrappedRowsWithOptionalSuffix(doc, line, maxWidth) {
    let body = line;
    let suffix = null;
    let suffixColor = null;
    if (line.endsWith(PDF_GUIDING_SUFFIX_YES)) {
        body = line.slice(0, -PDF_GUIDING_SUFFIX_YES.length);
        suffix = PDF_GUIDING_SUFFIX_YES;
        suffixColor = PDF_YES;
    } else if (line.endsWith(PDF_GUIDING_SUFFIX_NO)) {
        body = line.slice(0, -PDF_GUIDING_SUFFIX_NO.length);
        suffix = PDF_GUIDING_SUFFIX_NO;
        suffixColor = PDF_NO;
    }
    const rows = [];
    if (!suffix) {
        doc.splitTextToSize(body, maxWidth).forEach((chunk) => {
            rows.push([{ text: chunk, color: PDF_INK }]);
        });
        return rows;
    }
    const chunks = doc.splitTextToSize(body, maxWidth);
    if (chunks.length === 0) {
        rows.push([{ text: suffix, color: suffixColor }]);
        return rows;
    }
    for (let i = 0; i < chunks.length - 1; i++) {
        rows.push([{ text: chunks[i], color: PDF_INK }]);
    }
    const last = chunks[chunks.length - 1];
    const wLast = doc.getTextWidth(last);
    const wSuf = doc.getTextWidth(suffix);
    if (wLast + wSuf <= maxWidth) {
        rows.push([
            { text: last, color: PDF_INK },
            { text: suffix, color: suffixColor },
        ]);
    } else {
        rows.push([{ text: last, color: PDF_INK }]);
        rows.push([{ text: suffix, color: suffixColor }]);
    }
    return rows;
}

function pdfCountQuestionLineRows(doc, qLines, maxWidth, font, fontSize) {
    doc.setFont(font, 'normal');
    doc.setFontSize(fontSize);
    let n = 0;
    for (let i = 0; i < qLines.length; i++) {
        const physical = i === 0 ? `Question: ${qLines[i]}` : qLines[i];
        n += pdfBuildWrappedRowsWithOptionalSuffix(doc, physical, maxWidth).length;
    }
    return n;
}

/** @returns {number} y after the full question block */
function pdfDrawQuestionLines(doc, qLines, x, y0, maxWidth, lineHeight, font, fontSize) {
    doc.setFont(font, 'normal');
    doc.setFontSize(fontSize);
    let y = y0;
    for (let i = 0; i < qLines.length; i++) {
        const physical = i === 0 ? `Question: ${qLines[i]}` : qLines[i];
        const rows = pdfBuildWrappedRowsWithOptionalSuffix(doc, physical, maxWidth);
        y = pdfDrawTextRows(doc, rows, x, y, lineHeight);
    }
    doc.setTextColor(PDF_INK);
    return y;
}

function pdfMainAnswerWord(answer) {
    switch (answer.answer) {
        case 0:
            return { word: 'YES', color: PDF_YES };
        case 1:
            return { word: 'NO', color: PDF_NO };
        case 2:
            return { word: 'MAYBE', color: PDF_MAYBE };
        default:
            return { word: 'INCOMPLETE', color: PDF_INK };
    }
}

function pdfCountMainAnswerLines(doc, answer, maxWidth, font, fontSize) {
    doc.setFont(font, 'normal');
    doc.setFontSize(fontSize);
    const { word } = pdfMainAnswerWord(answer);
    return doc.splitTextToSize(`Answer: ${word}`, maxWidth).length;
}

/** Same low-level pattern as guiding: prefix ink, value colored when yes/no. */
function pdfDrawMainAnswerLine(doc, answer, x, y, maxWidth, font, fontSize) {
    doc.setFont(font, 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(PDF_INK);
    const prefix = 'Answer: ';
    doc.text(prefix, x, y);
    const prefixW = doc.getTextWidth(prefix);
    const { word, color } = pdfMainAnswerWord(answer);
    doc.setTextColor(color);
    doc.text(word, x + prefixW, y, { maxWidth: maxWidth - prefixW });
    doc.setTextColor(PDF_INK);
}

/** @param {HTMLElement} element @param {object} q @param {object} answerNode */
function renderQuestionInto(element, q, answerNode) {
    ensureGuidingAnswers(answerNode);
    const ga = answerNode.guidingAnswers;
    element.replaceChildren();
    const mainP = document.createElement('p');
    mainP.className = 'question-main';
    mainP.textContent = q.mainQuestion.text;
    element.appendChild(mainP);
    q.guiding.forEach((block, bi) => {
        const wrap = document.createElement('div');
        wrap.className = 'guiding-block';
        const heading = document.createElement('p');
        heading.className = 'guiding-heading';
        heading.textContent = block.heading;
        wrap.appendChild(heading);
        const ul = document.createElement('ul');
        ul.className = 'guiding-items';
        block.items.forEach((rawItem, ii) => {
            const { text, yesNo } = normalizeGuidingItem(rawItem);
            const li = document.createElement('li');
            li.className = 'guiding-item';
            const key = `${bi}-${ii}`;
            if (yesNo) {
                const row = document.createElement('div');
                row.className = 'guiding-item-row';
                const span = document.createElement('span');
                span.className = 'guiding-item-text';
                span.textContent = text;
                row.appendChild(span);
                const yn = document.createElement('span');
                yn.className = 'guiding-yesno';
                const mkBtn = (label, value) => {
                    const b = document.createElement('button');
                    b.type = 'button';
                    b.className =
                        value === 0 ? 'guiding-yn-btn guiding-yn-btn--yes' : 'guiding-yn-btn guiding-yn-btn--no';
                    b.textContent = label;
                    b.dataset.guidingKey = key;
                    b.dataset.guidingValue = String(value);
                    if (ga[key] === value) {
                        b.classList.add('guiding-yn-btn--selected');
                    }
                    b.addEventListener('click', () => {
                        const cur = ga[key];
                        if (cur === value) {
                            delete ga[key];
                        } else {
                            ga[key] = value;
                        }
                        yn.querySelectorAll('.guiding-yn-btn').forEach((btn) => {
                            const v = Number(btn.dataset.guidingValue);
                            btn.classList.toggle('guiding-yn-btn--selected', ga[key] === v);
                        });
                    });
                    return b;
                };
                yn.appendChild(mkBtn('Y', 0));
                yn.appendChild(mkBtn('N', 1));
                row.appendChild(yn);
                li.appendChild(row);
            } else {
                li.textContent = text;
            }
            ul.appendChild(li);
        });
        wrap.appendChild(ul);
        element.appendChild(wrap);
    });
}

const configPathPromise = fetch('./local-config.json')
    .then(response => response.json())
    .then(config => config.testGlobal ? './config.json' : './local-config.json')
    .catch(err => {
        console.error(err);
        return './config.json';
    });

let backendUrl = '';
configPathPromise.then(configPath => fetch(configPath))
    .then(response => response.json())
    .then(config => {
        backendUrl = config.backendUrl;
    }).catch(err => {
        document.getElementById('btn-send-email').remove();
        console.error(err);
    });

email = '';
questionHistory = [];
questionViewIndex = 0;
isCapable = -1;
answerNodeCache = {
    index: -1,
    answer: -1,
    notes: '',
    guidingAnswers: {}
}

function startAssessment() {
    document.querySelector('.start-screen').setAttribute('hidden', true);
    document.querySelector('.main-screen').hidden = false;
}

function saveAnswersJson() {
    answerNodeCache.notes = document.getElementById('answerInput').value;
    const JSONBlob = {
        answerHistory: questionHistory,
        currentAnswer: answerNodeCache,
        isCapable: isCapable
    }
    const answersJson = JSON.stringify(JSONBlob, null, 2);
    return answersJson;
}

function loadAnswersJson(inputJson) {
    const JSONBlob = JSON.parse(inputJson);
    questionHistory = JSONBlob.answerHistory;
    answerNodeCache = JSONBlob.currentAnswer;
    isCapable = JSONBlob.isCapable;
    questionHistory.forEach(ensureGuidingAnswers);
    ensureGuidingAnswers(answerNodeCache);
    questionViewIndex = questionHistory.length;
    updateQuestionView();
    updateAnswerView();
    document.querySelector('.start-screen').hidden = true;
    document.querySelector('.main-screen').removeAttribute('hidden');
}

function downloadAnswersJson() {
    const answersJson = saveAnswersJson();
    const blob = new Blob([answersJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = new Date().toLocaleTimeString() + ' - cappacity log.json';
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

async function downloadAnswersPdf(isEmail) {
    const buttons = Array.from(document.querySelectorAll("button")).filter(btn => !btn.disabled);
    buttons.forEach(btn => btn.disabled = true);
    try {
        const doc = new jsPDF({unit: 'pt'});
        const questions = (await questionsPromise).questions;
        const answersJson = JSON.parse(saveAnswersJson());
        const marginHorizontal = 36;
        const marginVertical = 54;
        const indent = 36;
        const pageWidth = doc.internal.pageSize.getWidth() - 2*marginHorizontal;
        const pageHeight = doc.internal.pageSize.getHeight() - 2*marginVertical;
        const font = "helvetica";
        const fontSize = 16;
        const titleFontSize = 36;
        const lineHeight = fontSize*doc.getLineHeightFactor();
        const titleLineHeight = titleFontSize*doc.getLineHeightFactor();
        let heightTicker = marginVertical;
        //title
        doc.setFontSize(titleFontSize);
        doc.setTextColor(PDF_TITLE);
        doc.text("Cappacity Assessment", doc.internal.pageSize.getWidth()/2, heightTicker + titleFontSize/2, {maxWidth: pageWidth, align: "center"});
        doc.setFontSize(fontSize);
        doc.setTextColor(PDF_INK);
        heightTicker += titleLineHeight + 0.5*lineHeight;
        //date
        doc.text(`Date: ${new Date().toLocaleDateString()}`, doc.internal.pageSize.getWidth()/2, heightTicker, {maxWidth: pageWidth, align: "center"});
        heightTicker += lineHeight;
        //time
        doc.text(`Time: ${new Date().toLocaleTimeString()}`, doc.internal.pageSize.getWidth()/2, heightTicker, {maxWidth: pageWidth, align: "center"});
        heightTicker += 2*lineHeight;
        //result
        doc.text(`Assesment result: ${answersJson.isCapable == 1 ? 'CAPABLE' : answersJson.isCapable == 0 ? 'NOT CAPABLE' : 'INCOMPLETE'}`, marginHorizontal, heightTicker, {maxWidth: pageWidth});
        heightTicker += lineHeight;
        //answers
        doc.text("Answers:", marginHorizontal, heightTicker, {maxWidth: pageWidth});
        heightTicker += 2*lineHeight;
        //questions
        const textMax = pageWidth - indent;
        const xBody = marginHorizontal + indent;
        [...answersJson.answerHistory, answersJson.currentAnswer].forEach((answer) => {
            const qLines = questionToPlainLines(questions[answer.index], answer.guidingAnswers);
            const qLen = pdfCountQuestionLineRows(doc, qLines, textMax, font, fontSize);
            const aLen = pdfCountMainAnswerLines(doc, answer, textMax, font, fontSize);
            const nText = answer.notes === '' ? '' : `Notes: ${answer.notes}`;
            const nLen = nText === '' ? 0 : doc.splitTextToSize(nText, textMax).length;
            if (heightTicker + lineHeight * (0.2 + qLen + aLen + nLen) > pageHeight) {
                doc.addPage();
                heightTicker = marginVertical;
            }
            heightTicker = pdfDrawQuestionLines(
                doc,
                qLines,
                xBody,
                heightTicker,
                textMax,
                lineHeight,
                font,
                fontSize
            );
            heightTicker += lineHeight * 0.1;
            pdfDrawMainAnswerLine(doc, answer, xBody, heightTicker, textMax, font, fontSize);
            heightTicker += lineHeight * (0.1 + aLen);
            if (nLen > 0) {
                doc.setFont(font, 'italic');
                doc.setTextColor(PDF_INK);
                doc.text(nText, xBody, heightTicker, { maxWidth: textMax });
                doc.setFont(font, 'normal');
                heightTicker += lineHeight * (0.1 + nLen);
            }
            heightTicker += 0.9 * lineHeight;
        });
        let fileName = new Date().toLocaleTimeString() + ' - cappacity log.pdf';
        if (isEmail) {
            // Prepare the PDF as a blob
            const pdfBlob = await doc.output('blob', { filename: fileName });

            // Form Data to send
            const formData = new FormData();
            formData.append('email', email);
            formData.append('file', pdfBlob, fileName);

            await fetch(backendUrl + '/api/sendEmail.php', {
                method: 'POST',
                body: formData
            })
            .then(response => {
                if (response.ok) {
                    alert("Email sent successfully!");
                } else {
                    response.json().then(body => {
                        alert("Failed to send email: " + (body.error || ""));
                    });
                }
            })
            .catch(err => {
                alert("There was an error sending the email. Please try again later.");
                console.error(err);
            });
        } else {
            doc.save(fileName);
        }
    } finally {
        buttons.forEach(btn => btn.disabled = false);
    }
}

function promptEmail() {
    if (email === '') {
        const emailPrompt = prompt('Please enter the recipient email address:');
        if (emailPrompt && emailPrompt.trim() !== '') {
            email = emailPrompt.trim();
            downloadAnswersPdf(true);
        } else if (emailPrompt !== null) {
            alert('Email address is required to send the answer log.');
        }
    } else {
        downloadAnswersPdf(true);
    }
}

function resetAnswers() {
    questionHistory = [];
    answerNodeCache = {
        index: -1,
        answer: -1,
        notes: '',
        guidingAnswers: {}
    }
    questionViewIndex = 0;
    document.getElementById('answerInput').value = '';
    removeVerdict();
    document.querySelector('.button-group').querySelectorAll('.btn').forEach(btn => btn.disabled = false)
    document.querySelector('.main-screen').hidden = true;
    document.querySelector('.start-screen').removeAttribute('hidden');
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
    document.querySelectorAll('.guiding-yn-btn').forEach((btn) => {
        btn.disabled = true;
    });
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
            notes: '',
            guidingAnswers: {}
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
    const answerNode = questionViewIndex >= questionHistory.length ? answerNodeCache : questionHistory[questionViewIndex];
    ensureGuidingAnswers(answerNode);
    const q = questions[answerNode.index];
    renderQuestionInto(questionElement, q, answerNode);
    
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

updateQuestionView();