/* Gemeinsame Konstanten, Trainingsplan-, Datums- und UI-Hilfsfunktionen. */

export const CURRENT_DATA_VERSION = 2;
export const STORAGE_KEY = "gymTrackerData";

// Rep-Ranges stammen unverändert aus den Excel-Überschriften in Zeile 2.
export const TRAINING_PLAN = {
  monday: {
    label: "Montag – Anteriore Kette / Ganzkörper Push",
    weekday: 1,
    exercises: [
      { name: "Schrägbank Kurzhantel Bankdrücken", targetSets: 3, repRange: { min: 6, max: 10 } },
      { name: "Dips", targetSets: 3, repRange: { min: 8, max: 12 } },
      { name: "Chest Flys", targetSets: 2, repRange: { min: 12, max: 15 } },
      { name: "Katana Extensions", targetSets: 2, repRange: { min: 10, max: 15 } },
      { name: "Beinstrecker", targetSets: 3, repRange: { min: 10, max: 15 } },
      { name: "Seitheben Maschine/Schulter", targetSets: 3, repRange: { min: 12, max: 20 } }
    ]
  },
  tuesday: {
    label: "Dienstag – Posteriore Kette / Ganzkörper Pull",
    weekday: 2,
    exercises: [
      { name: "T-Bar Row mit Brustauflage", targetSets: 3, repRange: { min: 6, max: 12 } },
      { name: "Latzug", targetSets: 3, repRange: { min: 8, max: 12 } },
      { name: "RDLs", targetSets: 2, repRange: { min: 6, max: 10 } },
      { name: "Beinbeuger", targetSets: 2, repRange: { min: 10, max: 15 } },
      { name: "Face Pulls", targetSets: 2, repRange: { min: 12, max: 15 } },
      { name: "Bicep Curls Ellenbogen hinter Körper", targetSets: 2, repRange: { min: 10, max: 12 } },
      { name: "Hanging Leg Raises", targetSets: 3, repRange: { min: 20, max: null, operator: ">" } }
    ]
  },
  thursday: {
    label: "Donnerstag – Brust & Arme",
    weekday: 4,
    exercises: [
      { name: "Schrägbank Bankdrücken Multipresse", targetSets: 3, repRange: { min: 8, max: 12 } },
      { name: "Brustpresse", targetSets: 2, repRange: { min: 8, max: 12 } },
      { name: "Hammer Curls", targetSets: 2, repRange: { min: 10, max: 12 } },
      { name: "Trizeps Pushdowns", targetSets: 2, repRange: { min: 10, max: 15 } },
      { name: "Preacher Curl", targetSets: 2, repRange: { min: 8, max: 12 } }
    ]
  },
  friday: {
    label: "Freitag – Lower Body",
    weekday: 5,
    exercises: [
      { name: "Beinpresse", targetSets: 2, repRange: { min: 8, max: 15 } },
      { name: "Beinstrecker", targetSets: 2, repRange: { min: 10, max: 15 } },
      { name: "Beinbeuger", targetSets: 2, repRange: { min: 8, max: 15 } },
      { name: "Adduktoren", targetSets: 2, repRange: { min: 12, max: 15 } },
      { name: "Waden", targetSets: 3, repRange: { min: 10, max: 12 } },
      { name: "Cable Crunches", targetSets: 4, repRange: { min: 20, max: 30 } }
    ]
  },
  saturday: {
    label: "Samstag – Schulter & Rücken",
    weekday: 6,
    exercises: [
      { name: "Kurzhantel Schulterdrücken", targetSets: 3, repRange: { min: 6, max: 10 } },
      { name: "Rudern mit Brustauflage sitzend", targetSets: 3, repRange: { min: 8, max: 12 } },
      { name: "Latzug eng im Untergriff", targetSets: 3, repRange: { min: 8, max: 12 } },
      { name: "Seitheben Kurzhantel", targetSets: 3, repRange: { min: 12, max: 20 } },
      { name: "Back Extensions", targetSets: 3, repRange: { min: 12, max: 20 } }
    ]
  }
};

export const ALL_EXERCISE_NAMES = [...new Set(
  Object.values(TRAINING_PLAN).flatMap(day => day.exercises.map(exercise => exercise.name))
)].sort((a, b) => a.localeCompare(b, "de"));

const noticeTimers = {};

export function showNotice(id, message, isError = false) {
  const notice = document.getElementById(id);
  notice.textContent = message;
  notice.classList.toggle("error", isError);
  notice.classList.add("show");
  clearTimeout(noticeTimers[id]);
  noticeTimers[id] = setTimeout(() => notice.classList.remove("show"), 4200);
  notice.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

export function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (!match) return new Date(value);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function formatDate(value) {
  const date = parseLocalDate(value);
  return Number.isNaN(date.getTime())
    ? String(value || "–")
    : new Intl.DateTimeFormat("de-DE", {
        day: "2-digit", month: "2-digit", year: "numeric"
      }).format(date);
}

export function formatShortDate(value) {
  const date = parseLocalDate(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("de-DE", {
        day: "2-digit", month: "2-digit"
      }).format(date);
}

export function formatNumber(value) {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 })
    .format(Number(value) || 0);
}

export function formatKg(value) {
  return `${formatNumber(value)} kg`;
}

export function parseLocalizedDecimal(value) {
  const input = String(value ?? "").trim();
  if (!/^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(input)) return null;
  const parsed = Number(input.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function confirmDestructiveAction(message) {
  const dialog = document.getElementById("confirm-dialog");
  const messageElement = document.getElementById("confirm-dialog-message");
  if (!dialog || typeof dialog.showModal !== "function") {
    return Promise.resolve(window.confirm(message));
  }

  if (dialog.open) dialog.close("cancel");
  messageElement.textContent = message;
  dialog.returnValue = "cancel";

  return new Promise(resolve => {
    const form = dialog.querySelector("form");
    let settled = false;
    const finish = confirmed => {
      if (settled) return;
      settled = true;
      form.removeEventListener("submit", handleSubmit);
      dialog.removeEventListener("cancel", handleCancel);
      dialog.removeEventListener("close", handleClose);
      if (dialog.open) dialog.close(confirmed ? "confirm" : "cancel");
      resolve(confirmed);
    };
    const handleSubmit = event => {
      event.preventDefault();
      finish(event.submitter?.value === "confirm");
    };
    const handleCancel = event => {
      event.preventDefault();
      finish(false);
    };
    const handleClose = () => finish(false);

    form.addEventListener("submit", handleSubmit);
    dialog.addEventListener("cancel", handleCancel);
    dialog.addEventListener("close", handleClose);
    dialog.showModal();
  });
}
