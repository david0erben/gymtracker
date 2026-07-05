/* Chronologische Workout-Historie mit Satzbearbeitung und sicherem Löschen. */

import {
  confirmDestructiveAction,
  formatDate,
  formatNumber,
  parseLocalizedDecimal,
  showNotice
} from "./utils.js";
import { getData, saveData } from "./storage.js";

let dataChangedCallback = () => {};

export function initializeHistory(onDataChanged = () => {}) {
  dataChangedCallback = onDataChanged;
}

export function renderHistory() {
  const data = getData();
  const list = document.getElementById("workout-history-list");
  const empty = document.getElementById("workout-history-empty");
  const workouts = [...data.workouts].sort((a, b) =>
    workoutTimestamp(b) - workoutTimestamp(a)
  );

  list.replaceChildren();
  empty.hidden = workouts.length > 0;
  workouts.forEach(workout => list.append(createWorkoutCard(workout)));
}

function createWorkoutCard(workout) {
  const card = document.createElement("article");
  card.className = "card history-workout";
  card.dataset.workoutId = workout.id;

  const header = document.createElement("div");
  header.className = "history-workout-header";
  const heading = document.createElement("div");
  heading.className = "history-workout-heading";
  const title = document.createElement("h3");
  title.textContent = formatDate(workout.date);
  const day = document.createElement("p");
  day.textContent = workout.trainingDayLabel || workout.trainingDay || "Training";
  heading.append(title, day);

  const remove = document.createElement("button");
  remove.className = "danger-button history-delete-button";
  remove.type = "button";
  remove.textContent = "🗑 Löschen";
  remove.setAttribute("aria-label", `Training vom ${formatDate(workout.date)} löschen`);
  remove.addEventListener("click", () => deleteWorkout(workout.id));
  header.append(heading, remove);

  const exercises = document.createElement("div");
  exercises.className = "history-exercises";
  workout.exercises.forEach(exercise => {
    exercises.append(createExerciseEditor(exercise));
  });

  card.append(header, exercises);
  return card;
}

function createExerciseEditor(exercise) {
  const section = document.createElement("section");
  section.className = "history-exercise";
  const title = document.createElement("h4");
  title.textContent = exercise.name;

  const header = document.createElement("div");
  header.className = "history-set-row history-set-header";
  ["Satz", "Reps", "Gewicht kg"].forEach(label => {
    const span = document.createElement("span");
    span.textContent = label;
    header.append(span);
  });

  const rows = document.createElement("div");
  exercise.sets.forEach((set, setIndex) => {
    rows.append(createSetEditor(exercise, set, setIndex));
  });
  section.append(title, header, rows);
  return section;
}

function createSetEditor(exercise, set, setIndex) {
  const row = document.createElement("div");
  row.className = "history-set-row";
  const number = document.createElement("span");
  number.className = "set-number";
  number.textContent = setIndex + 1;

  const reps = document.createElement("input");
  reps.className = "set-input history-set-input";
  reps.type = "text";
  reps.inputMode = "numeric";
  reps.value = set.reps == null ? "" : String(set.reps);
  reps.placeholder = "0";
  reps.setAttribute(
    "aria-label",
    `${exercise.name}, Satz ${setIndex + 1}, Wiederholungen`
  );
  reps.addEventListener("input", () => {
    const digitsOnly = reps.value.replace(/[^\d]/g, "");
    if (reps.value !== digitsOnly) reps.value = digitsOnly;
    set.reps = digitsOnly === "" ? null : Number(digitsOnly);
    persistWorkoutEdit();
  });

  const weight = document.createElement("input");
  weight.className = "set-input history-set-input";
  weight.type = "text";
  weight.inputMode = "decimal";
  weight.value = editableNumber(set.weight);
  weight.placeholder = "0,0";
  weight.setAttribute(
    "aria-label",
    `${exercise.name}, Satz ${setIndex + 1}, Gewicht in kg`
  );
  weight.addEventListener("input", () => {
    if (weight.value.trim() === "") {
      weight.removeAttribute("aria-invalid");
      set.weight = null;
      persistWorkoutEdit();
      return;
    }
    const parsed = parseLocalizedDecimal(weight.value);
    if (parsed === null || parsed < 0) {
      weight.setAttribute("aria-invalid", "true");
      return;
    }
    weight.removeAttribute("aria-invalid");
    set.weight = parsed;
    persistWorkoutEdit();
  });
  weight.addEventListener("blur", () => {
    weight.value = editableNumber(set.weight);
    weight.removeAttribute("aria-invalid");
  });

  row.append(number, reps, weight);
  return row;
}

function persistWorkoutEdit() {
  saveData();
  dataChangedCallback();
}

async function deleteWorkout(workoutId) {
  const confirmed = await confirmDestructiveAction(
    "Dieses Training wirklich löschen?"
  );
  if (!confirmed) return;

  const data = getData();
  data.workouts = data.workouts.filter(workout => workout.id !== workoutId);
  saveData();
  renderHistory();
  dataChangedCallback();
  showNotice("history-notice", "Training gelöscht.");
}

function workoutTimestamp(workout) {
  const completedAt = new Date(workout.completedAt || `${workout.date}T12:00:00`);
  const timestamp = completedAt.getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function editableNumber(value) {
  if (value == null || value === "") return "";
  const number = Number(value);
  return Number.isFinite(number)
    ? formatNumber(number)
    : String(value).replace(".", ",");
}
