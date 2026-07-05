/* Trainingstag, Satzerfassung, Entwurf und Workout-Abschluss. */

import {
  TRAINING_PLAN,
  createId,
  formatNumber,
  localDateString,
  parseLocalizedDecimal,
  showNotice
} from "./utils.js";
import { emptySet, getData, getDayDraft, saveData } from "./storage.js";

const TRAINING_AUTOSAVE_DELAY = 350;
let trainingAutosaveTimer = null;

export function initializeTraining() {
  document.getElementById("training-day").addEventListener("change", event => {
    const data = getData();
    data.draftWorkout.selectedDay = event.currentTarget.value;
    getDayDraft(data.draftWorkout.selectedDay);
    saveTrainingNow();
    renderWorkout();
  });
  document.getElementById("finish-workout").addEventListener("click", finishWorkout);
  window.addEventListener("pagehide", flushTrainingAutosave);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushTrainingAutosave();
  });
}

export function renderTraining() {
  renderTrainingDayOptions();
  renderWorkout();
}

function renderTrainingDayOptions() {
  const select = document.getElementById("training-day");
  select.replaceChildren();
  Object.entries(TRAINING_PLAN).forEach(([key, day]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = day.label;
    select.append(option);
  });
  select.value = getData().draftWorkout.selectedDay;
}

function renderWorkout() {
  const data = getData();
  const dayKey = data.draftWorkout.selectedDay;
  const plan = TRAINING_PLAN[dayKey];
  const draft = getDayDraft(dayKey);
  const list = document.getElementById("workout-list");
  list.replaceChildren();

  plan.exercises.forEach((exercise, exerciseIndex) => {
    const exerciseName = exercise.name;
    const card = document.createElement("article");
    card.className = "exercise-card";
    card.dataset.exerciseIndex = exerciseIndex;

    const head = document.createElement("div");
    head.className = "exercise-head";
    const title = document.createElement("h3");
    title.className = "exercise-title";
    title.textContent = exerciseName;
    const count = document.createElement("span");
    count.className = "set-count";
    count.textContent = formatTrainingTarget(exercise);
    head.append(title, count);

    const header = document.createElement("div");
    header.className = "set-header";
    ["Satz", "Reps", "Gewicht kg", ""].forEach(label => {
      const span = document.createElement("span");
      span.textContent = label;
      if (!label) span.setAttribute("aria-hidden", "true");
      header.append(span);
    });

    const rows = document.createElement("div");
    draft.exercises[exerciseName].forEach((set, setIndex) => {
      rows.append(createSetRow(
        exerciseName,
        exerciseIndex,
        setIndex,
        set,
        exercise.targetSets
      ));
    });

    const addButton = document.createElement("button");
    addButton.className = "add-set";
    addButton.type = "button";
    addButton.textContent = "+ Satz";
    addButton.addEventListener("click", () => {
      draft.exercises[exerciseName].push(emptySet());
      saveTrainingNow();
      renderWorkout();
      const inputs = document.querySelectorAll(
        `[data-exercise-index="${exerciseIndex}"][data-kind="reps"]`
      );
      inputs[inputs.length - 1]?.focus();
    });

    card.append(head, header, rows, addButton);
    list.append(card);
  });
}

function formatTrainingTarget(exercise) {
  const setLabel = `${exercise.targetSets} ${
    exercise.targetSets === 1 ? "Zielsatz" : "Zielsätze"
  }`;
  const range = exercise.repRange;
  if (!range || !Number.isFinite(range.min)) return setLabel;
  if (range.operator === ">" && range.max == null) {
    return `${setLabel} · >${range.min} Reps`;
  }
  if (!Number.isFinite(range.max) || range.min === range.max) {
    return `${setLabel} · ${range.min} Reps`;
  }
  return `${setLabel} · ${range.min}–${range.max} Reps`;
}

function createSetRow(exerciseName, exerciseIndex, setIndex, set, targetSets) {
  const row = document.createElement("div");
  row.className = "set-row";
  const number = document.createElement("span");
  number.className = "set-number";
  number.textContent = setIndex + 1;

  const reps = document.createElement("input");
  reps.className = "set-input";
  reps.type = "text";
  reps.inputMode = "numeric";
  reps.pattern = "[0-9]*";
  reps.placeholder = "0";
  reps.value = set.reps == null ? "" : String(set.reps);
  if (reps.value !== "" && (!Number.isInteger(Number(reps.value)) || Number(reps.value) <= 0)) {
    reps.setAttribute("aria-invalid", "true");
  }
  reps.setAttribute("aria-label", `${exerciseName}, Satz ${setIndex + 1}, Wiederholungen`);

  const weight = document.createElement("input");
  weight.className = "set-input";
  weight.type = "text";
  weight.inputMode = "decimal";
  weight.placeholder = "0,0";
  weight.value = editableWeight(set.weight);
  if (weight.value !== "" && Number(set.weight) <= 0) {
    weight.setAttribute("aria-invalid", "true");
  }
  weight.setAttribute("aria-label", `${exerciseName}, Satz ${setIndex + 1}, Gewicht in kg`);

  [reps, weight].forEach((input, index) => {
    input.dataset.exerciseIndex = exerciseIndex;
    input.dataset.setIndex = setIndex;
    input.dataset.kind = index === 0 ? "reps" : "weight";
    input.addEventListener("input", handleSetInput);
    input.addEventListener("blur", normalizeSetInput);
    input.addEventListener("keydown", focusNextOnEnter);
  });

  const action = document.createElement(setIndex >= targetSets ? "button" : "span");
  if (setIndex >= targetSets) {
    action.className = "remove-set";
    action.type = "button";
    action.textContent = "×";
    action.title = "Satz entfernen";
    action.setAttribute(
      "aria-label",
      `${exerciseName}, Satz ${setIndex + 1} entfernen`
    );
    action.addEventListener("click", () => {
      const data = getData();
      const dayKey = data.draftWorkout.selectedDay;
      getDayDraft(dayKey).exercises[exerciseName].splice(setIndex, 1);
      saveTrainingNow();
      renderWorkout();
      document.querySelector(
        `.exercise-card[data-exercise-index="${exerciseIndex}"] .add-set`
      )?.focus();
    });
  } else {
    action.className = "remove-set-placeholder";
    action.setAttribute("aria-hidden", "true");
  }

  row.append(number, reps, weight, action);
  return row;
}

function handleSetInput(event) {
  const input = event.currentTarget;
  const data = getData();
  const dayKey = data.draftWorkout.selectedDay;
  const exerciseName = TRAINING_PLAN[dayKey].exercises[
    Number(input.dataset.exerciseIndex)
  ].name;
  const set = getDayDraft(dayKey).exercises[exerciseName][Number(input.dataset.setIndex)];

  if (input.dataset.kind === "reps") {
    const repsInput = input.value.trim();
    if (repsInput === "") {
      input.removeAttribute("aria-invalid");
      set.reps = "";
    } else {
      if (!/^\d+$/.test(repsInput)) {
        input.setAttribute("aria-invalid", "true");
        return;
      }
      const reps = Number(repsInput);
      if (!Number.isInteger(reps) || reps <= 0) {
        input.setAttribute("aria-invalid", "true");
        return;
      }
      input.removeAttribute("aria-invalid");
      set.reps = reps;
    }
  } else {
    if (input.value.trim() === "") {
      input.removeAttribute("aria-invalid");
      set.weight = "";
    } else {
      const weight = parseLocalizedDecimal(input.value);
      if (weight === null || weight <= 0) {
        input.setAttribute("aria-invalid", "true");
        return;
      }
      input.removeAttribute("aria-invalid");
      set.weight = weight;
    }
  }
  scheduleTrainingAutosave();
}

function normalizeSetInput(event) {
  const input = event.currentTarget;
  if (input.getAttribute("aria-invalid") === "true") return;
  const set = draftSetForInput(input);
  if (!set) return;
  input.value = input.dataset.kind === "weight"
    ? editableWeight(set.weight)
    : set.reps == null || set.reps === "" ? "" : String(set.reps);
}

function draftSetForInput(input) {
  const data = getData();
  const dayKey = data.draftWorkout.selectedDay;
  const exerciseName = TRAINING_PLAN[dayKey].exercises[
    Number(input.dataset.exerciseIndex)
  ].name;
  return getDayDraft(dayKey).exercises[exerciseName][Number(input.dataset.setIndex)];
}

function scheduleTrainingAutosave() {
  clearTimeout(trainingAutosaveTimer);
  trainingAutosaveTimer = setTimeout(() => {
    trainingAutosaveTimer = null;
    saveData();
  }, TRAINING_AUTOSAVE_DELAY);
}

function flushTrainingAutosave() {
  if (trainingAutosaveTimer === null) return;
  clearTimeout(trainingAutosaveTimer);
  trainingAutosaveTimer = null;
  saveData();
}

function saveTrainingNow() {
  clearTimeout(trainingAutosaveTimer);
  trainingAutosaveTimer = null;
  saveData();
}

function focusNextOnEnter(event) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  const inputs = [...document.querySelectorAll("#workout-list .set-input")];
  const next = inputs[inputs.indexOf(event.currentTarget) + 1];
  if (next) next.focus();
  else document.getElementById("finish-workout").focus();
}

function finishWorkout() {
  const invalidInput = document.querySelector("#workout-list .set-input[aria-invalid='true']");
  if (invalidInput) {
    showNotice(
      "training-notice",
      "Bitte korrigiere ungültige Wiederholungen oder Gewichte.",
      true
    );
    invalidInput.focus();
    return;
  }

  const data = getData();
  const dayKey = data.draftWorkout.selectedDay;
  const draft = getDayDraft(dayKey);
  const exercises = [];
  let enteredSetCount = 0;

  TRAINING_PLAN[dayKey].exercises.forEach(({ name }) => {
    const sets = draft.exercises[name]
      .filter(set => set.reps !== "" || set.weight !== "")
      .map(set => {
        enteredSetCount += 1;
        return {
          reps: set.reps === "" ? null : Math.trunc(Number(set.reps)),
          weight: set.weight === "" ? null : Number(set.weight)
        };
      });
    if (sets.length) exercises.push({ name, sets });
  });

  if (!enteredSetCount) {
    showNotice("training-notice", "Trage zuerst mindestens einen Satz ein.", true);
    return;
  }

  const now = new Date();
  data.workouts.push({
    id: createId(),
    date: localDateString(now),
    completedAt: now.toISOString(),
    trainingDay: dayKey,
    trainingDayLabel: TRAINING_PLAN[dayKey].label,
    exercises
  });
  delete data.draftWorkout.days[dayKey];
  getDayDraft(dayKey);
  saveTrainingNow();
  renderWorkout();
  showNotice("training-notice", "Workout gespeichert. Stark gemacht!");
}

function editableWeight(value) {
  if (value == null || value === "") return "";
  const weight = Number(value);
  return Number.isFinite(weight) ? formatNumber(weight) : "";
}
