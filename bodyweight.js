/* Körpergewichtseingabe, bestätigtes Löschen, Verlaufsliste und Diagramm. */

import {
  confirmDestructiveAction,
  createId,
  formatDate,
  formatKg,
  localDateString,
  parseLocalizedDecimal,
  showNotice
} from "./utils.js";
import { getData, saveData } from "./storage.js";
import { drawLineChart } from "./charts.js";

export function initializeBodyweight() {
  document.getElementById("bodyweight-form").addEventListener("submit", saveBodyweight);
  document.getElementById("bodyweight-date").value = localDateString(new Date());
}

export function renderBodyweight() {
  const data = getData();
  const list = document.getElementById("weight-list");
  const empty = document.getElementById("weight-empty");
  list.replaceChildren();
  empty.hidden = data.bodyweight.length > 0;

  [...data.bodyweight].sort((a, b) => b.date.localeCompare(a.date)).forEach(entry => {
    const item = document.createElement("li");
    item.className = "weight-item";
    const text = document.createElement("div");
    const value = document.createElement("div");
    value.className = "weight-value";
    value.textContent = formatKg(entry.weight);
    const date = document.createElement("div");
    date.className = "weight-date";
    date.textContent = formatDate(entry.date);
    text.append(value, date);

    const remove = document.createElement("button");
    remove.className = "icon-button";
    remove.type = "button";
    remove.textContent = "×";
    remove.title = `Eintrag vom ${formatDate(entry.date)} löschen`;
    remove.setAttribute("aria-label", remove.title);
    remove.addEventListener("click", async () => {
      const confirmed = await confirmDestructiveAction(
        "Körpergewichtseintrag wirklich löschen?"
      );
      if (!confirmed) return;
      data.bodyweight = data.bodyweight.filter(item => item.id !== entry.id);
      saveData();
      renderBodyweight();
      showNotice("bodyweight-notice", "Körpergewichtseintrag gelöscht.");
    });
    item.append(text, remove);
    list.append(item);
  });

  const chartData = [...data.bodyweight]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(entry => ({ label: entry.date, value: Number(entry.weight) }));
  requestAnimationFrame(() =>
    drawLineChart("bodyweight-chart", chartData, "kg", "Körpergewicht")
  );
}

function saveBodyweight(event) {
  event.preventDefault();
  const data = getData();
  const dateInput = document.getElementById("bodyweight-date");
  const weightInput = document.getElementById("bodyweight-value");
  const weight = parseLocalizedDecimal(weightInput.value);
  if (!dateInput.value || weight === null || weight <= 0) {
    showNotice("bodyweight-notice", "Bitte gib ein gültiges Datum und Gewicht ein.", true);
    return;
  }

  const existing = data.bodyweight.find(entry => entry.date === dateInput.value);
  if (existing) {
    existing.weight = weight;
  } else {
    data.bodyweight.push({ id: createId(), date: dateInput.value, weight });
  }
  data.bodyweight.sort((a, b) => a.date.localeCompare(b.date));
  saveData();
  weightInput.value = "";
  renderBodyweight();
  showNotice("bodyweight-notice", existing ? "Eintrag aktualisiert." : "Gewicht gespeichert.");
}
