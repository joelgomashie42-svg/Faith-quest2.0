// app.js for Faith Quest PWA
// relies on questions.js being loaded first

// --- App state ---
let QUESTIONS = window.QUESTIONS || {};
let currentQuiz = [];
let currentIndex = 0;
let score = 0;
let wrong = [];
let quizMeta = {};
let deferredStart = null;
let selectedBookOrCategory = null;
let selectedMode = null; // 'book' or 'category'
let selectedDifficulty = null;

// --- Splash animation (bounce-drop letters) ---
const APP_NAME = "FAITH QUEST";
function playWhoosh() {
  // simple whoosh using WebAudio short tone
  try {
    const ctx = window.__audio_ctx || (window.__audio_ctx = new (window.AudioContext || window.webkitAudioContext)());
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type='sine'; o.frequency.value = 880; g.gain.value = 0.02;
    o.connect(g); g.connect(ctx.destination); o.start();
    setTimeout(()=>{ o.frequency.value = 420; g.gain.value=0.01 }, 80);
    setTimeout(()=> o.stop(), 220);
  } catch(e){}
}
function splashIntro() {
  const titleWrap = document.getElementById('title-wrap');
  titleWrap.innerHTML = '';
  for (let i=0;i<APP_NAME.length;i++){
    const ch = APP_NAME[i] === ' ' ? '\u00A0' : APP_NAME[i];
    const span = document.createElement('span');
    span.className = 'letter';
    span.textContent = ch;
    titleWrap.appendChild(span);
  }
  const letters = Array.from(document.querySelectorAll('.letter'));
  letters.forEach((el,i)=>{
    setTimeout(()=>{
      el.style.transition = 'transform 500ms cubic-bezier(.2,1.2,.4,1), opacity 300ms';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
      // light bounce using transform
      el.animate([{transform:'translateY(-40px)'},{transform:'translateY(6px)'},{transform:'translateY(0)'}], {duration:500, easing:'ease-out'});
      playWhoosh();
    }, i*140);
  });
  // show icon after letters finished
  setTimeout(()=>{
    document.getElementById('icon-holder').classList.remove('hidden');
    const icon = document.getElementById('splashIcon');
    icon.style.opacity = 0; icon.style.transform = 'scale(.6)';
    icon.animate([{opacity:0, transform:'scale(.6)'},{opacity:1, transform:'scale(1.03)'},{opacity:1, transform:'scale(1)'}], {duration:600, easing:'ease-out'});
    icon.style.opacity=1; icon.style.transform='scale(1)';
  }, APP_NAME.length*140 + 200);

  // move to main after 2.2s more
  setTimeout(()=>{ document.getElementById('splash').classList.add('hidden'); document.getElementById('main').classList.remove('hidden'); initMain(); }, APP_NAME.length*140 + 2500);
}

// --- Main init (verse, register SW, attach events) ---
function initMain(){
  showVerse();
  registerSW();
  // ensure audio unlocked on first user tap
  document.body.addEventListener('click', unlockAudioOnce, {once:true});
}

function unlockAudioOnce(){ try{ window.__audio_ctx = new (window.AudioContext || window.webkitAudioContext)(); window.__audio_ctx.resume && window.__audio_ctx.resume(); }catch(e){} }

// --- Verse (random each load) ---
function showVerse(){
  const s = window.SCRIPTURES || ['Trust in the Lord. - Proverbs 3:5'];
  document.getElementById('verse').innerText = s[Math.floor(Math.random()*s.length)];
}

// --- Navigation helpers ---
function goToMode(){
  document.getElementById('welcome').scrollIntoView({behavior:'smooth'});
  document.getElementById('modeCard').classList.remove('hidden');
  document.getElementById('welcome').classList.add('hidden');
}

function openAbout(){
  hideAll(); document.getElementById('aboutCard').classList.remove('hidden');
}
function hideAll(){
  ['modeCard','levelCard','quizCard','resultCard','aboutCard'].forEach(id=>{document.getElementById(id).classList.add('hidden')});
}

// --- Book & category views ---
function showBooks(which){
  selectedMode = 'book';
  selectedBookOrCategory = null;
  const list = which==='old' ? BOOKS.OLD : BOOKS.NEW;
  const container = document.getElementById('byOptions');
  let html = '<div class="small">Choose a book:</div><div class="row mt">';
  list.forEach(b=> html += `<button class="btn" onclick="selectBook('${b.key}','${b.name}')">${b.name}</button>`);
  html += '</div>';
  container.innerHTML = html;
}

function showCategories(){
  selectedMode = 'category';
  selectedBookOrCategory = null;
  const container = document.getElementById('byOptions');
  let html = '<div class="small">Choose a category:</div><div class="row mt">';
  (window.CATEGORIES||[]).forEach(c=> html += `<button class="btn" onclick="selectCategory('${c.key}','${c.name}')">${c.name}</button>`);
  html += '</div>';
  container.innerHTML = html;
}

function selectBook(key,name){
  selectedBookOrCategory = {key,name};
  // show level choose
  document.getElementById('levelCard').classList.remove('hidden');
  document.getElementById('modeCard').classList.add('hidden');
}
function selectCategory(key,name){
  selectedBookOrCategory = {key,name};
  document.getElementById('levelCard').classList.remove('hidden');
  document.getElementById('modeCard').classList.add('hidden');
}

// --- Start with chosen level ---
function startWithLevel(level){
  selectedDifficulty = level;
  startQuizFromSelection();
}

// --- Build quiz based on selection ---
function startQuizFromSelection(){
  currentQuiz = [];
  if(!selectedBookOrCategory){ alert('No selection'); return; }
  if(selectedMode === 'book'){
    for(const sec of Object.keys(QUESTIONS)){
      QUESTIONS[sec].forEach(q=>{ if(q.bookKey === selectedBookOrCategory.key && q.difficulty===selectedDifficulty) currentQuiz.push(q); });
    }
    if(currentQuiz.length===0){
      for(const sec of Object.keys(QUESTIONS)) QUESTIONS[sec].forEach(q=>{ if(q.bookKey === selectedBookOrCategory.key) currentQuiz.push(q); });
    }
  } else {
    for(const sec of Object.keys(QUESTIONS)){
      QUESTIONS[sec].forEach(q=>{ if(q.category === selectedBookOrCategory.key && q.difficulty===selectedDifficulty) currentQuiz.push(q); });
    }
    if(currentQuiz.length===0){
      for(const sec of Object.keys(QUESTIONS)) QUESTIONS[sec].forEach(q=>{ if(q.category === selectedBookOrCategory.key) currentQuiz.push(q); });
    }
  }
  if(currentQuiz.length===0){ alert('No questions found for this selection.'); return; }
  // shuffle and limit (10)
  currentQuiz = shuffleArray(currentQuiz).slice(0,10);
  currentIndex = 0; score=0; wrong=[];
  quizMeta = {title: selectedBookOrCategory.name, difficulty: selectedDifficulty, total: currentQuiz.length};
  // show quiz UI
  hideAll();
  document.getElementById('quizCard').classList.remove('hidden');
  document.getElementById('quizTitle') && (document.getElementById('quizTitle').innerText = quizMeta.title.toUpperCase());
  renderQuestion();
  updateScore();
  updateProgress();
}

// --- Render question ---
function renderQuestion(){
  const q = currentQuiz[currentIndex];
  const area = document.getElementById('qcard');
  area.innerHTML = '';
  if(!q){ area.innerHTML = '<div class="small">No question</div>'; return; }
  const h = document.createElement('div'); h.innerHTML = `<div class="small"><strong>Q ${currentIndex+1}/${quizMeta.total}</strong> • ${q.book || ''}</div>`;
  area.appendChild(h);
  const p = document.createElement('div'); p.innerHTML = `<h3 style="margin-top:8px">${q.question}</h3>`;
  area.appendChild(p);
  // options
  q.options.forEach((opt,i)=>{
    const b = document.createElement('button');
    b.className = 'option';
    b.innerText = opt;
    b.onclick = ()=> handleAnswer(b,i,q);
    area.appendChild(b);
  });
}

// --- Answer handling with feedback + sounds ---
function handleAnswer(btn, idx, q){
  // prevent double
  const opts = Array.from(document.querySelectorAll('.option'));
  opts.forEach(o=> o.disabled=true);
  const correctIdx = q.answer;
  if(idx === correctIdx){
    btn.classList.add('correct');
    playCorrectSound();
    score++;
  } else {
    btn.classList.add('wrong');
    // reveal correct
    if(opts[correctIdx]) opts[correctIdx].classList.add('correct');
    playWrongSound();
    wrong.push({q:q.question, correct:q.options[correctIdx], your:q.options[idx]});
  }
  updateScore();
  updateProgress();
  // auto next after 1.6s (show feedback)
  setTimeout(()=> {
    if(currentIndex < currentQuiz.length-1){ currentIndex++; renderQuestion(); updateProgress(); }
    else finishQuiz();
  }, 1600);
}

// navigation
function nextQ(){ if(currentIndex < currentQuiz.length-1){ currentIndex++; renderQuestion(); updateProgress(); } else finishQuiz(); }
function prevQ(){ if(currentIndex>0){ currentIndex--; renderQuestion(); updateProgress(); } }
function endQuiz(){ if(confirm('End quiz?')) finishQuiz(); }
function finishQuiz(){
  document.getElementById('quizCard').classList.add('hidden');
  document.getElementById('resultCard').classList.remove('hidden');
  document.getElementById('resultText').innerText = `You scored ${score} out of ${quizMeta.total}`;
  const wl = document.getElementById('wrongList'); wl.innerHTML='';
  wrong.forEach(w=> wl.innerHTML += `<div class="card"><strong>${w.q}</strong><div class="small">Correct: ${w.correct} • Your answer: ${w.your}</div></div>`);
  saveHighScore(score);
}

// restart
function restart(){
  document.getElementById('resultCard').classList.add('hidden');
  document.getElementById('welcome').classList.remove('hidden');
  document.getElementById('modeCard').classList.add('hidden');
  showVerse();
}

// score & progress
function updateScore(){ document.getElementById('scoreBoard').innerText = `Score: ${score}`; }
function updateProgress(){ const pct = ((currentIndex+1)/Math.max(1, quizMeta.total))*100; document.getElementById('progressBar').style.width = pct + '%'; }

// share
function shareScore(){ const txt = `I scored ${score} on Faith Quest (${quizMeta.title})`; if(navigator.share) navigator.share({title:'Faith Quest', text:txt}); else prompt('Copy score text', txt); }

// utilities
function shuffleArray(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]] } return a; }
function saveHighScore(s){ const key='faith_highscores'; const arr=JSON.parse(localStorage.getItem(key)||'[]'); arr.push({score:s,when:new Date().toISOString()}); arr.sort((a,b)=>b.score-a.score); localStorage.setItem(key, JSON.stringify(arr.slice(0,10))); }

// --- Sounds: preload short tones ---
function playCorrectSound(){ try{ const ctx = window.__audio_ctx || (window.__audio_ctx = new (window.AudioContext || window.webkitAudioContext)()); const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type='sine'; o.frequency.value=880; g.gain.value=0.05; o.start(); setTimeout(()=>o.stop(),140);}catch(e){} }
function playWrongSound(){ try{ const ctx = window.__audio_ctx || (window.__audio_ctx = new (window.AudioContext || window.webkitAudioContext)()); const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type='square'; o.frequency.value=220; g.gain.value=0.06; o.start(); setTimeout(()=>o.stop(),200);}catch(e){} }

// --- PWA helpers: register SW + manifest linking if needed ---
async function registerSW(){
  if('serviceWorker' in navigator){
    try{
      await navigator.serviceWorker.register('service-worker.js');
      console.log('sw registered');
    }catch(e){console.log('sw fail',e)}
  }
}

// --- Load everything ---
window.addEventListener('load', ()=>{
  // prepare splash letters and start
  splashIntro();
});
