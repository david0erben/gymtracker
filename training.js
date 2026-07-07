/* Trainingstag, Satzerfassung, Entwurf und Workout-Abschluss. */

import {
  TRAINING_PLAN,
  createId,
  formatNumber,
  localDateString,
  parseLocalizedDecimal,
  showNotice
} from "./utils.js";
import {
  emptySet,
  getData,
  getDayDraft,
  getLastExerciseSets,
  saveData
} from "./storage.js";

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
    const previousSets = getLastExerciseSets(exerciseName);
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
        exercise.targetSets,
        previousSets[setIndex]
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

function createSetRow(
  exerciseName,
  exerciseIndex,
  setIndex,
  set,
  targetSets,
  previousSet
) {
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
  reps.placeholder = previousRepsPlaceholder(previousSet);
  reps.value = set.reps == null ? "" : String(set.reps);
  if (reps.value !== "" && (!Number.isInteger(Number(reps.value)) || Number(reps.value) <= 0)) {
    reps.setAttribute("aria-invalid", "true");
  }
  reps.setAttribute("aria-label", `${exerciseName}, Satz ${setIndex + 1}, Wiederholungen`);

  const weight = document.createElement("input");
  weight.className = "set-input";
  weight.type = "text";
  weight.inputMode = "decimal";
  weight.placeholder = previousWeightPlaceholder(previousSet);
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

async function finishWorkout() {
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
  const enteredSetCount = countEnteredSets(dayKey, draft);

  if (enteredSetCount === 0) {
    showNotice("training-notice", "Trage zuerst mindestens einen Satz ein.", true);
    return;
  }

  const missingExerciseNames = missingPlannedExercises(dayKey, draft);
  const confirmedSkippedNames = missingExerciseNames.length
    ? await confirmMissingExercises(missingExerciseNames)
    : [];
  if (missingExerciseNames.length && !confirmedSkippedNames.length) return;

  const exercises = buildWorkoutExercises(
    dayKey,
    draft,
    new Set(confirmedSkippedNames)
  );
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

function countEnteredSets(dayKey, draft) {
  return TRAINING_PLAN[dayKey].exercises.reduce((count, { name }) =>
    count + draft.exercises[name].filter(isEnteredSet).length, 0);
}

function missingPlannedExercises(dayKey, draft) {
  return TRAINING_PLAN[dayKey].exercises
    .map(exercise => exercise.name)
    .filter(name =>
      !draft.exercises[name].some(isEnteredSet) &&
      !isDraftExerciseSkipped(draft, name) &&
      !isDraftExerciseReplaced(draft, name)
    );
}

function buildWorkoutExercises(dayKey, draft, confirmedSkippedNames) {
  const exercises = [];
  TRAINING_PLAN[dayKey].exercises.forEach(({ name }) => {
    const sets = completedSets(draft.exercises[name]);
    if (sets.length) {
      exercises.push({ name, sets });
      return;
    }
    if (isDraftExerciseSkipped(draft, name) || confirmedSkippedNames.has(name)) {
      exercises.push({ name, skipped: true, sets: [] });
    }
  });
  return exercises;
}

function completedSets(sets) {
  return sets
    .filter(isEnteredSet)
    .map(set => ({
      reps: set.reps === "" || set.reps == null ? null : Math.trunc(Number(set.reps)),
      weight: set.weight === "" || set.weight == null ? null : Number(set.weight)
    }));
}

function isEnteredSet(set) {
  return Boolean(set) && (
    (set.reps !== "" && set.reps != null) ||
    (set.weight !== "" && set.weight != null)
  );
}

function isDraftExerciseSkipped(draft, exerciseName) {
  return Boolean(
    hasExerciseMarker(draft.skippedExercises, exerciseName) ||
    hasExerciseMarker(draft.skipped, exerciseName) ||
    hasExerciseFlag(draft.exerciseStatus, exerciseName, "skipped") ||
    hasExerciseFlag(draft.exerciseMeta, exerciseName, "skipped") ||
    hasExerciseFlag(draft.exercisesMeta, exerciseName, "skipped") ||
    hasExerciseFlag(draft.exercises, exerciseName, "skipped")
  );
}

function isDraftExerciseReplaced(draft, exerciseName) {
  return Boolean(
    hasExerciseMarker(draft.replacedExercises, exerciseName) ||
    hasExerciseMarker(draft.replacements, exerciseName) ||
    hasExerciseMarker(draft.exerciseReplacements, exerciseName) ||
    hasExerciseFlag(draft.exerciseStatus, exerciseName, "replaced") ||
    hasExerciseFlag(draft.exerciseMeta, exerciseName, "replaced") ||
    hasExerciseFlag(draft.exercisesMeta, exerciseName, "replaced") ||
    hasExerciseFlag(draft.exercises, exerciseName, "replaced") ||
    exerciseMetaValue(draft.exerciseStatus, exerciseName, "replacedBy") ||
    exerciseMetaValue(draft.exerciseMeta, exerciseName, "replacedBy") ||
    exerciseMetaValue(draft.exercisesMeta, exerciseName, "replacedBy") ||
    exerciseMetaValue(draft.replacements, exerciseName, "name") ||
    exerciseMetaValue(draft.replacements, exerciseName, "replacementName")
  );
}

function hasExerciseMarker(collection, exerciseName) {
  if (!collection) return false;
  if (Array.isArray(collection)) {
    return collection.some(item =>
      item === exerciseName ||
      item?.name === exerciseName ||
      item?.exerciseName === exerciseName ||
      item?.originalName === exerciseName
    );
  }
  if (typeof collection === "object") {
    return Boolean(collection[exerciseName]);
  }
  return false;
}

function hasExerciseFlag(collection, exerciseName, flagName) {
  return exerciseMetaValue(collection, exerciseName, flagName) === true;
}

function exerciseMetaValue(collection, exerciseName, key) {
  if (!collection || typeof collection !== "object") return undefined;
  const meta = collection[exerciseName];
  return meta && typeof meta === "object" ? meta[key] : undefined;
}

function confirmMissingExercises(exerciseNames) {
  const dialog = document.getElementById("missing-exercises-dialog");
  const list = document.getElementById("missing-exercises-list");
  if (!dialog || !list || typeof dialog.showModal !== "function") {
    showNotice(
      "training-notice",
      "Einige Übungen fehlen. Bitte prüfe dein Training vor dem Abschließen.",
      true
    );
    return Promise.resolve([]);
  }

  if (dialog.open) dialog.close("back");
  list.replaceChildren(...exerciseNames.map(name => {
    const item = document.createElement("li");
    item.textContent = name;
    return item;
  }));
  dialog.returnValue = "back";

  return new Promise(resolve => {
    const form = dialog.querySelector("form");
    let settled = false;
    const finish = shouldFinishWorkout => {
      if (settled) return;
      settled = true;
      form.removeEventListener("submit", handleSubmit);
      dialog.removeEventListener("cancel", handleCancel);
      dialog.removeEventListener("close", handleClose);
      if (dialog.open) dialog.close(shouldFinishWorkout ? "finish" : "back");
      resolve(shouldFinishWorkout ? exerciseNames : []);
    };
    const handleSubmit = event => {
      event.preventDefault();
      finish(event.submitter?.value === "finish");
    };
    const handleCancel = event => {
      event.preventDefault();
      finish(false);
    };
    const handleClose = () => finish(dialog.returnValue === "finish");

    form.addEventListener("submit", handleSubmit);
    dialog.addEventListener("cancel", handleCancel);
    dialog.addEventListener("close", handleClose);
    dialog.showModal();
  });
}

function editableWeight(value) {
  if (value == null || value === "") return "";
  const weight = Number(value);
  return Number.isFinite(weight) ? formatNumber(weight) : "";
}

function previousRepsPlaceholder(previousSet) {
  return previousSet?.reps == null ? "" : String(previousSet.reps);
}

function previousWeightPlaceholder(previousSet) {
  return previousSet?.weight == null ? "" : formatNumber(previousSet.weight);
}
