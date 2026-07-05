/* Reine Analyseansicht mit Bestleistungen, Volumen und 1RM-Verlauf. */

import {
  ALL_EXERCISE_NAMES,
  formatDate,
  formatKg,
  formatNumber
} from "./utils.js";
import { getData } from "./storage.js";
import { drawLineChart } from "./charts.js";

let analyticsMode = "best";

export function initializeAnalytics() {
  document.getElementById("exercise-select").addEventListener("change", renderAnalytics);
  document.querySelectorAll("[data-analytics-mode]").forEach(button => {
    button.addEventListener("click", () => {
      analyticsMode = button.dataset.analyticsMode;
      renderAnalytics();
    });
  });
}

export function renderAnalytics() {
  renderExerciseOptions();
  const selected = document.getElementById("exercise-select").value || ALL_EXERCISE_NAMES[0];
  const history = exerciseHistory(selected);
  document.querySelectorAll("[data-analytics-mode]").forEach(button => {
    const active = button.dataset.analyticsMode === analyticsMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  const empty = document.getElementById("analytics-empty");
  const content = document.getElementById("analytics-content");
  const allSets = document.getElementById("analytics-all-sets");
  const hasData = history.length > 0;
  empty.hidden = hasData;
  content.hidden = !hasData || analyticsMode !== "best";
  allSets.hidden = !hasData || analyticsMode !== "all";
  if (!hasData) return;
  if (analyticsMode === "all") {
    renderAllSetsTable(history);
    return;
  }

  const bestE1rm = Math.max(...history.map(item => item.e1rm));
  const bestVolume = Math.max(...history.map(item => item.volume));
  const bestSet = history
    .map(item => item.bestWeightSet)
    .reduce((best, set) =>
      set.weight > best.weight || (set.weight === best.weight && set.reps > best.reps)
        ? set
        : best,
      { reps: 0, weight: 0 }
    );
  document.getElementById("exercise-stats").replaceChildren(
    statElement(
      `${formatNumber(bestSet.weight)} kg × ${bestSet.reps}`,
      "Bester Satz"
    ),
    statElement(formatKg(bestE1rm), "Bestes geschätztes 1RM"),
    statElement(`${formatNumber(bestVolume)} kg`, "Höchstes Gesamtvolumen")
  );

  requestAnimationFrame(() => {
    drawLineChart("one-rm-chart", history.map(item => ({
      label: item.date,
      value: item.e1rm
    })), "kg", "geschätztes 1RM");
    drawLineChart("volume-chart", history.map(item => ({
      label: item.date,
      value: item.volume
    })), "kg", "Volumen");
  });
}

export function exerciseHistory(exerciseName) {
  return getData().workouts
    .map(workout => {
      const exercise = workout.exercises.find(item => item.name === exerciseName);
      if (!exercise || !Array.isArray(exercise.sets) || !exercise.sets.length) return null;
      const sets = exercise.sets
        .filter(set => set && (set.reps != null || set.weight != null))
        .map(set => ({
          reps: Number(set.reps) || 0,
          weight: Number(set.weight) || 0
        }));
      if (!sets.length) return null;

      const bestWeightSet = sets.reduce((best, set) =>
        set.weight > best.weight || (set.weight === best.weight && set.reps > best.reps)
          ? set : best, { reps: 0, weight: 0 });
      const volume = sets.reduce((sum, set) => sum + set.weight * set.reps, 0);
      const e1rm = sets.reduce((best, set) =>
        Math.max(best, set.weight * (1 + set.reps / 30)), 0);

      return {
        date: workout.date || String(workout.completedAt || "").slice(0, 10),
        completedAt: workout.completedAt || `${workout.date}T12:00:00`,
        sets,
        bestWeightSet,
        volume,
        e1rm
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));
}

function renderExerciseOptions() {
  const select = document.getElementById("exercise-select");
  const current = select.value;
  select.replaceChildren();
  ALL_EXERCISE_NAMES.forEach(name => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.append(option);
  });
  if (ALL_EXERCISE_NAMES.includes(current)) select.value = current;
}

function renderAllSetsTable(history) {
  const head = document.getElementById("all-sets-head");
  const body = document.getElementById("all-sets-body");
  const maxSets = Math.max(...history.map(item => item.sets.length));
  head.replaceChildren();
  body.replaceChildren();

  const headerRow = document.createElement("tr");
  ["Datum", ...Array.from(
    { length: maxSets },
    (_, index) => `Satz ${index + 1}`
  ), "Gesamtvolumen"].forEach(label => {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = label;
    headerRow.append(cell);
  });
  head.append(headerRow);

  [...history].reverse().forEach(item => {
    const row = document.createElement("tr");
    const values = [
      formatDate(item.date),
      ...Array.from({ length: maxSets }, (_, index) =>
        item.sets[index] ? formatSet(item.sets[index]) : "–"
      ),
      `${formatNumber(item.volume)} kg`
    ];
    values.forEach(value => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    });
    body.append(row);
  });
}

function formatSet(set) {
  return `${formatNumber(set.reps)} × ${formatNumber(set.weight)} kg`;
}

function statElement(value, label) {
  const stat = document.createElement("div");
  stat.className = "stat";
  const strong = document.createElement("span");
  strong.className = "stat-value";
  strong.textContent = value;
  const small = document.createElement("span");
  small.className = "stat-label";
  small.textContent = label;
  stat.append(strong, small);
  return stat;
}
