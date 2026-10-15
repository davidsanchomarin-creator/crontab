
const ids = ["minute", "hour", "day", "month", "weekday"];

const rules = [
  { min: 0, max: 59, name: "minuto" },
  { min: 0, max: 23, name: "hora" },
  { min: 1, max: 31, name: "día del mes" },
  { min: 1, max: 12, name: "mes" },
  { min: 0, max: 7, name: "día de la semana" }
];

const $ = id => document.getElementById(id);
const inputs = ids.map($);

let questions = [];
let current = 0;
let mode = "easy";
let answered = new Set();
let correct = new Set();
let checked = false;

async function init() {
  try {
    const response = await fetch("preguntas.json");
    if (!response.ok) throw new Error("No se encuentra preguntas.json");

    questions = await response.json();

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error("El fichero no contiene preguntas.");
    }

    render();
  } catch (error) {
    $("question").textContent = "No se pudieron cargar las preguntas.";
    showFeedback(
      "bad",
      error.message + ". Abre la aplicación mediante Live Server."
    );
    $("check").disabled = true;
  }
}

function render() {
  checked = false;

  const q = questions[current];
  $("counter").textContent =
    `Pregunta ${current + 1} de ${questions.length}`;
  $("question").textContent = q.question;
  $("mode-label").textContent =
    mode === "easy" ? "Modo fácil" : "Modo difícil";

  $("progress").style.width =
    `${current / questions.length * 100}%`;

  inputs.forEach(input => {
    input.value = "";
    input.disabled = false;
    input.setAttribute("aria-invalid", "false");
  });

  $("feedback").hidden = true;
  $("check").hidden = false;
  $("check").disabled = false;
  $("next").hidden = true;

  updateStats();
  inputs[0].focus();
}

function validField(value, rule) {
  value = value.trim();
  if (!value) return false;

  // Admite *, números, listas, rangos e intervalos.
  const parts = value.split(",");

  return parts.every(part => {
    const interval = part.split("/");
    if (interval.length > 2) return false;

    const base = interval[0];

    if (interval.length === 2) {
      if (!/^\d+$/.test(interval[1]) ||
          Number(interval[1]) < 1) return false;
    }

    if (base === "*") return true;

    const range = base.match(/^(\d+)-(\d+)$/);

    if (range) {
      const a = Number(range[1]);
      const b = Number(range[2]);

      return a >= rule.min && a <= rule.max &&
             b >= rule.min && b <= rule.max && a <= b;
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

function checkAnswer() {
  if (checked) return;

  const values = inputs.map(input => input.value.trim());

  if (values.some(value => value === "")) {
    showFeedback("bad", "Completa los cinco campos antes de comprobar.");
    return;
  }

  if (mode === "easy") {
    const invalid = values.findIndex(
      (value, index) => !validField(value, rules[index])
    );

    if (invalid !== -1) {
      inputs[invalid].setAttribute("aria-invalid", "true");
      inputs[invalid].focus();

      showFeedback(
        "bad",
        `El campo «${rules[invalid].name}» tiene un formato ` +
        "incorrecto o está fuera de rango."
      );
      return;
    }
  }

  checked = true;
  answered.add(current);

  const expected = questions[current].answer;
  const isCorrect = values.every(
    (value, index) => value === expected[index]
  );

  if (isCorrect) {
    correct.add(current);
    showFeedback("good", "¡Correcto! Expresión: " + values.join(" "));
  } else {
    showFeedback(
      "bad",
      "La respuesta correcta es: " + expected.join(" ") +
      "\n" + questions[current].hint
    );
  }

  inputs.forEach(input => input.disabled = true);
  $("check").hidden = true;
  $("next").hidden = false;
  $("progress").style.width =
    `${answered.size / questions.length * 100}%`;

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

    showFeedback(
      "good",
      `Resultado final: ${correct.size} aciertos de ${questions.length}.`
    );

    inputs.forEach(input => input.disabled = true);
  }
}

function updateStats() {
  $("answered").textContent = `${answered.size} / ${questions.length}`;
  $("correct").textContent = correct.size;

  $("score").textContent = answered.size
    ? `${Math.round(correct.size / answered.size * 100)}%`
    : "0%";
}

function reset() {
  current = 0;
  answered.clear();
  correct.clear();
  render();
}

document.querySelectorAll('input[name="mode"]').forEach(radio => {
  radio.addEventListener("change", () => {
    mode = radio.value;
    render();
  });
});

$("check").addEventListener("click", checkAnswer);
$("next").addEventListener("click", nextQuestion);
$("skip").addEventListener("click", nextQuestion);
$("reset").addEventListener("click", reset);

inputs.forEach((input, index) => {
  input.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();

      if (index < inputs.length - 1) {
        inputs[index + 1].focus();
      } else {
        checkAnswer();
      }
    }
  });
});

init();
