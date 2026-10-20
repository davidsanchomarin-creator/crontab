const $ = id => document.getElementById(id);
const cronIds = ["minute", "hour", "day", "month", "weekday"];
const onCalendarIds = ["oc-weekday", "oc-month", "oc-day", "oc-hour", "oc-minute"];
const cronRules = [
  { min: 0, max: 59, name: "minuto" },
  { min: 0, max: 23, name: "hora" },
  { min: 1, max: 31, name: "día del mes" },
  { min: 1, max: 12, name: "mes" },
  { min: 0, max: 7, name: "día de la semana" }
];

let topic = "cron";
let mode = "easy";
let questions = [];
let allQuestions = [];
let current = 0;
let answered = new Set();
let correct = new Set();
let wrong = new Set();
let retryMode = false;
let checked = false;

function activeInputs() {
  return topic === "cron" ? cronIds.map($) : onCalendarIds.map($);
}

function shuffleQuestions() {
  for (let i = questions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [questions[i], questions[j]] = [questions[j], questions[i]];
  }
}

async function loadTopic(newTopic) {
  topic = newTopic;
  $("check").disabled = false;
  $("topic-select").disabled = true;
  try {
    const filename = topic === "cron" ? "preguntas.json" : "preguntas_oncalendar.json";
    const response = await fetch(filename);
    if (!response.ok) throw new Error("No se encuentra " + filename);
    const loaded = await response.json();
    if (!Array.isArray(loaded) || loaded.length === 0) throw new Error("El banco no contiene preguntas.");

    questions = loaded;
    allQuestions = questions.slice();
    current = 0;
    answered.clear();
    correct.clear();
    wrong.clear();
    retryMode = false;
    $("cron-fields").hidden = topic !== "cron";
    $("oncalendar-fields").hidden = topic !== "oncalendar";
    $("tip-cron").hidden = topic !== "cron";
    $("tip-oncalendar").hidden = topic !== "oncalendar";
    $("exercise-label").textContent = topic === "cron" ? "EXPRESIÓN CRON" : "SYSTEMD TIMERS · ONCALENDAR";
    $("instructions").textContent = topic === "cron"
      ? "Completa los cinco campos de la expresión."
      : "Completa los campos; la aplicación construirá la expresión OnCalendar.";
    shuffleQuestions();
    render();
  } catch (error) {
    $("question").textContent = "No se pudo cargar el banco de preguntas.";
    showFeedback("bad", error.message + ". Abre la aplicación mediante Live Server.");
    $("check").disabled = true;
  } finally {
    $("topic-select").disabled = false;
  }
}

function render() {
  checked = false;
  const q = questions[current];
  if (!q) return;
  $("counter").textContent = `${retryMode ? "Repaso" : "Pregunta"} ${current + 1} de ${questions.length}`;
  $("question").textContent = q.question;
  $("mode-label").textContent = mode === "easy" ? "Modo fácil" : "Modo difícil";
  $("progress").style.width = `${current / questions.length * 100}%`;

  activeInputs().forEach(input => {
    input.value = "";
    input.disabled = false;
    input.setAttribute("aria-invalid", "false");
  });
  $("feedback").hidden = true;
  $("check").hidden = false;
  $("check").disabled = false;
  $("next").hidden = true;
  updateRetryButton();
  updateStats();
  activeInputs()[0].focus();
}

function buildOnCalendar(values) {
  const [weekday, month, day, hour, minute] = values.map(v => v.trim());
  return `${weekday === "*" ? "" : weekday + " "}*-${month}-${day} ${hour}:${minute}:00`;
}

function updateOnCalendarPreview() {
  const values = onCalendarIds.map(id => $(id).value);
  $("oncalendar-preview").textContent = buildOnCalendar(values);
}

function validOnCalendarField(value, kind) {
  if (!value.trim()) return false;
  const v = value.trim();
  if (kind === "weekday") return /^(\*|(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:(?:\.\.(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun))|(?:,(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)))*)$/.test(v);
  // Supports numeric values, wildcard, lists, ranges and /step intervals.
  if (!/^[0-9*.,/\-]+$/.test(v)) return false;
  return true;
}

function validCronField(value, rule) {
  value = value.trim();
  if (!value) return false;
  return value.split(",").every(part => {
    const interval = part.split("/");
    if (interval.length > 2) return false;
    const base = interval[0];
    if (interval.length === 2 && (!/^\d+$/.test(interval[1]) || Number(interval[1]) < 1)) return false;
    if (base === "*") return true;
    const range = base.match(/^(\d+)-(\d+)$/);
    if (range) {
      const a = Number(range[1]), b = Number(range[2]);
      return a >= rule.min && a <= rule.max && b >= rule.min && b <= rule.max && a <= b;
    }
    if (/^\d+$/.test(base)) {
      const n = Number(base);
      return n >= rule.min && n <= rule.max;
    }
    return false;
  });
}

function showFeedback(kind, message) {
  const box = $("feedback");
  box.className = `feedback ${kind}`;
  box.textContent = message;
  box.hidden = false;
}

function normalizeAnswer(value) {
  return String(value).trim().replace(/\s+/g, " ");
}

function checkAnswer() {
  if (checked) return;
  const inputs = activeInputs();
  const values = inputs.map(input => input.value.trim());
  if (values.some(value => value === "")) {
    showFeedback("bad", "Completa todos los campos antes de comprobar.");
    return;
  }

  if (mode === "easy") {
    if (topic === "cron") {
      const invalid = values.findIndex((value, index) => !validCronField(value, cronRules[index]));
      if (invalid !== -1) {
        inputs[invalid].setAttribute("aria-invalid", "true");
        inputs[invalid].focus();
        showFeedback("bad", `El campo «${cronRules[invalid].name}» tiene un formato incorrecto o está fuera de rango.`);
        return;
      }
    } else {
      const kinds = ["weekday", "month", "day", "hour", "minute"];
      const invalid = values.findIndex((value, index) => !validOnCalendarField(value, kinds[index]));
      if (invalid !== -1) {
        inputs[invalid].setAttribute("aria-invalid", "true");
        inputs[invalid].focus();
        showFeedback("bad", `El campo «${kinds[invalid]}» tiene un formato incorrecto.`);
        return;
      }
    }
  }

  checked = true;
  answered.add(current);
  const q = questions[current];
  const acceptedAnswers = q.answers ?? (q.answer ? [q.answer] : []);
  const matchingAnswer = acceptedAnswers.find(answer => {
    if (topic === "cron") {
      return Array.isArray(answer) && answer.length === 5 &&
        values.every((value, index) => normalizeAnswer(value) === normalizeAnswer(answer[index]));
    }
    return Array.isArray(answer) && answer.length === 1 &&
      normalizeAnswer(buildOnCalendar(values)).toLowerCase() === normalizeAnswer(answer[0]).toLowerCase();
  });
  const isCorrect = Boolean(matchingAnswer);

  if (isCorrect) {
    correct.add(current);
    wrong.delete(q);
    showFeedback("good", "¡Correcto! Expresión: " + (topic === "cron" ? values.join(" ") : buildOnCalendar(values)) +
      (q.explanation ? "\n\n¿Por qué? " + q.explanation : ""));
  } else {
    wrong.add(q);
    const expectedText = acceptedAnswers.map(answer => topic === "cron" ? answer.join(" ") : answer[0]).join(" / ");
    showFeedback("bad", "Una respuesta válida es: " + expectedText +
      (q.explanation ? "\n\n¿Por qué? " + q.explanation : "") +
      (q.hint ? "\n\nPista: " + q.hint : ""));
  }

  inputs.forEach(input => input.disabled = true);
  $("check").hidden = true;
  $("next").hidden = false;
  $("progress").style.width = `${answered.size / questions.length * 100}%`;
  updateStats();
}

function nextQuestion() {
  if (current < questions.length - 1) {
    current++;
    render();
  } else {
    $("question").textContent = "¡Has terminado la práctica!";
    $("counter").textContent = "Práctica completada";
    $("progress").style.width = "100%";
    $("check").hidden = true;
    $("next").hidden = true;
    showFeedback("good", `Resultado final: ${correct.size} aciertos de ${questions.length}.` +
      (wrong.size ? `\nPreguntas falladas: ${wrong.size}. Puedes repetirlas para practicar.` : "\n¡No has fallado ninguna pregunta!"));
    activeInputs().forEach(input => input.disabled = true);
    updateRetryButton();
  }
}

function updateRetryButton() {
  const button = $("retry-wrong");
  if (!button) return;
  button.hidden = wrong.size === 0;
  $("wrong-count").textContent = String(wrong.size);
}

function updateStats() {
  $("answered").textContent = `${answered.size} / ${questions.length}`;
  $("correct").textContent = correct.size;
  $("score").textContent = answered.size ? `${Math.round(correct.size / answered.size * 100)}%` : "0%";
  updateRetryButton();
}

function retryWrongQuestions() {
  if (!wrong.size) return;
  questions = allQuestions.filter(question => wrong.has(question));
  current = 0;
  answered.clear();
  correct.clear();
  wrong.clear();
  retryMode = true;
  shuffleQuestions();
  render();
}

function reset() {
  questions = allQuestions.slice();
  current = 0;
  answered.clear();
  correct.clear();
  wrong.clear();
  retryMode = false;
  shuffleQuestions();
  render();
}

$("topic-select").addEventListener("change", event => loadTopic(event.target.value));
document.querySelectorAll('input[name="mode"]').forEach(radio => {
  radio.addEventListener("change", () => { mode = radio.value; render(); });
});
onCalendarIds.forEach(id => $(id).addEventListener("input", updateOnCalendarPreview));
$("check").addEventListener("click", checkAnswer);
$("next").addEventListener("click", nextQuestion);
$("skip").addEventListener("click", nextQuestion);
$("reset").addEventListener("click", reset);
$("retry-wrong").addEventListener("click", retryWrongQuestions);
document.addEventListener("keydown", event => {
  if (event.key !== "Enter" || event.target.tagName !== "INPUT") return;
  event.preventDefault();
  const inputs = activeInputs();
  const index = inputs.indexOf(event.target);
  if (index >= 0 && index < inputs.length - 1) inputs[index + 1].focus();
  else checkAnswer();
});

loadTopic("cron");
