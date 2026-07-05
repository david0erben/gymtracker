/* Trainingstag, Satzerfassung, Entwurf und Workout-Abschluss. */

import { TRAINING_PLAN, createId, localDateString, showNotice } from "./utils.js";
import { emptySet, getData, getDayDraft, saveData } from "./storage.js";

export function initializeTraining() {
  document.getElementById("training-day").addEventListener("change", event => {
    const data = getData();
    data.draftWorkout.selectedDay = event.currentTarget.value;
    getDayDraft(data.draftWorkout.selectedDay);
    saveData();
    renderWorkout();
  });
  document.getElementById("finish-workout").addEventListener("click", finishWorkout);
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
    ["Satz", "Reps", "Gewicht kg"].forEach(label => {
      const span = document.createElement("span");
      span.textContent = label;
      header.append(span);
    });

    const rows = document.createElement("div");
    draft.exercises[exerciseName].forEach((set, setIndex) => {
      rows.append(createSetRow(exerciseName, exerciseIndex, setIndex, set));
    });

    const addButton = document.createElement("button");
    addButton.className = "add-set";
    addButton.type = "button";
    addButton.textContent = "+ Satz";
    addButton.addEventListener("click", () => {
      draft.exercises[exerciseName].push(emptySet());
      saveData();
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

function createSetRow(exerciseName, exerciseIndex, setIndex, set) {
  const row = document.createElement("div");
  row.className = "set-row";
  const number = document.createElement("span");
  number.className = "set-number";
  number.textContent = setIndex + 1;

  const reps = document.createElement("input");
  reps.className = "set-input";
  reps.type = "number";
  reps.inputMode = "numeric";
  reps.min = "0";
  reps.step = "1";
  reps.placeholder = "0";
  reps.value = set.reps;
  reps.setAttribute("aria-label", `${exerciseName}, Satz ${setIndex + 1}, Wiederholungen`);

  const weight = document.createElement("input");
  weight.className = "set-input";
  weight.type = "number";
  weight.inputMode = "decimal";
  weight.min = "0";
  weight.step = "0.1";
  weight.placeholder = "0,0";
  weight.value = set.weight;
  weight.setAttribute("aria-label", `${exerciseName}, Satz ${setIndex + 1}, Gewicht in kg`);

  [reps, weight].forEach((input, index) => {
    input.dataset.exerciseIndex = exerciseIndex;
    input.dataset.setIndex = setIndex;
    input.dataset.kind = index === 0 ? "reps" : "weight";
    input.addEventListener("input", handleSetInput);
    input.addEventListener("keydown", focusNextOnEnter);
  });
  row.append(number, reps, weight);
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
    const digitsOnly = input.value.replace(/[^\d]/g, "");
    if (input.value !== digitsOnly) input.value = digitsOnly;
    set.reps = digitsOnly;
  } else {
    set.weight = input.value;
  }
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
          reps: set.reps === "" ? null : Math.max(0, Math.trunc(Number(set.reps))),
          weight: set.weight === "" ? null : Math.max(0, Number(set.weight))
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
  saveData();
  renderWorkout();
  showNotice("training-notice", "Workout gespeichert. Stark gemacht!");
}
