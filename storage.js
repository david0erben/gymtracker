/* Zentrale Datenhaltung: LocalStorage-Cache, Firestore-Sync und JSON-Backups. */

import {
  CURRENT_DATA_VERSION,
  STORAGE_KEY,
  TRAINING_PLAN,
  createId,
  localDateString,
  showNotice
} from "./utils.js";

let data;
let services = null;
let cloudDocument = null;
let currentUser = null;
let unsubscribeCloud = null;
let syncTimer = null;
let syncReady = false;
let cloudWriteInProgress = false;
let unsyncedChanges = false;
let localRevision = 0;
const dataListeners = new Set();

export function getData() {
  return data;
}

export function subscribeToData(listener) {
  dataListeners.add(listener);
  return () => dataListeners.delete(listener);
}

function notifyDataListeners() {
  dataListeners.forEach(listener => listener(data));
}

export function initializeStorage() {
  updateSyncControls();
  document.getElementById("sync-now").addEventListener("click", pushDataToCloud);
  document.getElementById("cloud-load").addEventListener("click", loadCloudDataManually);
  document.getElementById("cloud-overwrite").addEventListener("click", overwriteCloudData);
  document.getElementById("cloud-delete").addEventListener("click", deleteCloudData);
  document.getElementById("export-data").addEventListener("click", exportData);
  document.getElementById("import-data").addEventListener("change", importData);
  document.getElementById("reload-excel-data").addEventListener("click", reloadExcelData);
  document.getElementById("delete-data").addEventListener("click", deleteLocalData);

  window.addEventListener("offline", () =>
    setSyncStatus("Offline / Sync fehlgeschlagen", "error")
  );
  window.addEventListener("online", () => {
    if (unsyncedChanges) scheduleCloudSync();
    else if (currentUser) setSyncStatus("Verbindung wird wiederhergestellt …", "pending");
  });
  window.addEventListener("pagehide", () => {
    if (unsyncedChanges && syncReady && !cloudWriteInProgress) pushDataToCloud();
  });
}

export function connectFirebaseStorage(firebaseServices) {
  services = firebaseServices;
  updateSyncControls();
}

export async function handleAuthChange(user) {
  currentUser = user;
  updateSyncControls();
  if (unsubscribeCloud) {
    unsubscribeCloud();
    unsubscribeCloud = null;
  }
  syncReady = false;
  cloudDocument = null;

  if (!user) {
    setSyncStatus("Anmeldung erforderlich", "local");
    return;
  }
  await startCloudSync();
}

export function emptySet() {
  return { reps: "", weight: "" };
}

export function getDayDraft(dayKey) {
  if (!data.draftWorkout.days[dayKey]) {
    data.draftWorkout.days[dayKey] = { exercises: {} };
  }
  const draft = data.draftWorkout.days[dayKey];
  if (!draft.exercises || typeof draft.exercises !== "object") draft.exercises = {};

  TRAINING_PLAN[dayKey].exercises.forEach(({ name, targetSets }) => {
    if (!Array.isArray(draft.exercises[name])) {
      draft.exercises[name] = Array.from({ length: targetSets }, emptySet);
    }
    while (draft.exercises[name].length < targetSets) {
      draft.exercises[name].push(emptySet());
    }
    draft.exercises[name] = draft.exercises[name].map(set => ({
      reps: set && set.reps != null ? String(set.reps) : "",
      weight: set && set.weight != null ? String(set.weight) : ""
    }));
  });
  return draft;
}

export function saveData() {
  saveLocalCache();
  localRevision += 1;
  unsyncedChanges = true;
  scheduleCloudSync();
}

export function saveLocalCache() {
  data.version = CURRENT_DATA_VERSION;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  updateDataSummary();
}

export function updateDataSummary() {
  const summary = document.getElementById("data-summary");
  if (!summary) return;
  summary.replaceChildren(
    summaryValue(data.workouts.length, "Workouts"),
    summaryValue(data.bodyweight.length, "Gewichtseinträge")
  );
}

export function setSyncStatus(message, state = "local") {
  const status = document.getElementById("sync-status");
  const headerStatus = document.getElementById("header-sync-status");
  if (status) {
    status.textContent = message;
    status.dataset.state = state;
  }
  if (headerStatus) headerStatus.textContent = message;
}

export function handleSyncError(error) {
  console.warn("Firebase-Synchronisierung fehlgeschlagen.", error);
  setSyncStatus("Offline / Sync fehlgeschlagen", "error");
}

function suggestedDay() {
  const weekday = new Date().getDay();
  const match = Object.entries(TRAINING_PLAN).find(([, day]) => day.weekday === weekday);
  return match ? match[0] : "monday";
}

function emptyData() {
  return {
    version: CURRENT_DATA_VERSION,
    workouts: [],
    bodyweight: [],
    draftWorkout: { selectedDay: suggestedDay(), days: {} }
  };
}

function loadData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      const parsed = JSON.parse(stored);
      if (hasMeaningfulUserData(parsed)) return normalizeData(parsed);
    }
    const seeded = normalizeData(cloneExcelSeedData());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  } catch (error) {
    console.warn("Gespeicherte Daten konnten nicht gelesen werden.", error);
    return normalizeData(cloneExcelSeedData());
  }
}

function hasMeaningfulUserData(raw) {
  if (!raw || typeof raw !== "object") return false;
  if (Array.isArray(raw.workouts) && raw.workouts.length > 0) return true;
  if (Array.isArray(raw.bodyweight) && raw.bodyweight.length > 0) return true;
  const draft = raw.draftWorkout;
  if (!draft || typeof draft !== "object") return false;
  const exerciseGroups = [];
  if (draft.exercises && typeof draft.exercises === "object") {
    exerciseGroups.push(draft.exercises);
  }
  if (draft.days && typeof draft.days === "object") {
    Object.values(draft.days).forEach(day => {
      if (day && day.exercises) exerciseGroups.push(day.exercises);
    });
  }
  return exerciseGroups.some(exercises =>
    Object.values(exercises).some(sets =>
      Array.isArray(sets) && sets.some(set =>
        set && (
          (set.reps !== "" && set.reps != null) ||
          (set.weight !== "" && set.weight != null)
        )
      )
    )
  );
}

function normalizeData(raw) {
  const fallback = emptyData();
  if (!raw || typeof raw !== "object") return fallback;
  const normalized = {
    version: CURRENT_DATA_VERSION,
    workouts: Array.isArray(raw.workouts) ? raw.workouts : [],
    bodyweight: Array.isArray(raw.bodyweight) ? raw.bodyweight : [],
    draftWorkout: raw.draftWorkout && typeof raw.draftWorkout === "object"
      ? raw.draftWorkout
      : fallback.draftWorkout
  };

  if (!normalized.draftWorkout.days) {
    const oldDay = normalized.draftWorkout.selectedDay || suggestedDay();
    const oldExercises = normalized.draftWorkout.exercises || {};
    normalized.draftWorkout = {
      selectedDay: TRAINING_PLAN[oldDay] ? oldDay : suggestedDay(),
      days: { [oldDay]: { exercises: oldExercises } }
    };
  }
  if (!TRAINING_PLAN[normalized.draftWorkout.selectedDay]) {
    normalized.draftWorkout.selectedDay = suggestedDay();
  }
  if (!normalized.draftWorkout.days || typeof normalized.draftWorkout.days !== "object") {
    normalized.draftWorkout.days = {};
  }

  normalized.workouts = normalized.workouts
    .filter(workout => workout && typeof workout === "object" && Array.isArray(workout.exercises))
    .map(workout => ({ ...workout, id: workout.id || createId() }));
  normalized.bodyweight = normalized.bodyweight
    .filter(entry =>
      entry && typeof entry.date === "string" && Number.isFinite(Number(entry.weight))
    )
    .map(entry => ({ ...entry, id: entry.id || createId(), weight: Number(entry.weight) }));
  return normalized;
}

async function startCloudSync() {
  if (!currentUser || !services) return;
  cloudDocument = services.firestoreApi.doc(
    services.db,
    "users",
    currentUser.uid,
    "data",
    "main"
  );
  setSyncStatus("Cloud-Daten werden geladen …", "pending");
  try {
    const snapshot = await services.firestoreApi.getDoc(cloudDocument);
    syncReady = true;
    if (snapshot.exists()) {
      applyCloudData(snapshot.data());
    } else if (hasMeaningfulUserData(data)) {
      await pushDataToCloud();
    } else {
      setSyncStatus("Cloud-Daten leer", "local");
    }
    startCloudListener();
    if (!unsyncedChanges) setSyncStatus("Synchronisiert", "success");
  } catch (error) {
    syncReady = false;
    handleSyncError(error);
  }
  updateSyncControls();
}

function startCloudListener() {
  if (!cloudDocument) return;
  if (unsubscribeCloud) unsubscribeCloud();
  unsubscribeCloud = services.firestoreApi.onSnapshot(
    cloudDocument,
    snapshot => {
      if (snapshot.metadata.hasPendingWrites) return;
      if (!snapshot.exists()) {
        if (!cloudWriteInProgress) setSyncStatus("Cloud-Daten leer", "local");
        return;
      }
      if (cloudWriteInProgress || unsyncedChanges) return;
      const incoming = normalizeData(snapshot.data());
      if (dataSignature(incoming) !== dataSignature(data)) {
        applyCloudData(snapshot.data());
      } else {
        setSyncStatus("Synchronisiert", "success");
      }
    },
    handleSyncError
  );
}

function applyCloudData(raw) {
  const requiresMigration = Number(raw && raw.version) !== CURRENT_DATA_VERSION;
  clearTimeout(syncTimer);
  syncTimer = null;
  unsyncedChanges = false;
  data = normalizeData(raw);
  notifyDataListeners();
  saveLocalCache();
  if (requiresMigration) {
    localRevision += 1;
    unsyncedChanges = true;
    scheduleCloudSync();
  } else {
    setSyncStatus("Synchronisiert", "success");
  }
}

function cloudPayload(source = data) {
  return {
    version: CURRENT_DATA_VERSION,
    workouts: source.workouts,
    bodyweight: source.bodyweight,
    draftWorkout: source.draftWorkout
  };
}

function dataSignature(source) {
  return JSON.stringify(cloudPayload(source));
}

function scheduleCloudSync() {
  clearTimeout(syncTimer);
  syncTimer = null;
  if (!currentUser || !syncReady || !cloudDocument) {
    setSyncStatus("Lokal gespeichert · Anmeldung erforderlich", "local");
    return;
  }
  if (cloudWriteInProgress) {
    setSyncStatus("Änderungen warten auf Synchronisierung …", "pending");
    return;
  }
  setSyncStatus(
    navigator.onLine ? "Änderungen werden synchronisiert …" : "Offline · Sync vorgemerkt",
    "pending"
  );
  syncTimer = setTimeout(() => {
    syncTimer = null;
    pushDataToCloud();
  }, 800);
}

async function pushDataToCloud() {
  if (!currentUser || !syncReady || !cloudDocument) {
    setSyncStatus("Anmeldung erforderlich", "local");
    return false;
  }
  clearTimeout(syncTimer);
  syncTimer = null;
  const revisionAtStart = localRevision;
  let needsFollowUp = false;
  cloudWriteInProgress = true;
  setSyncStatus(navigator.onLine ? "Synchronisiere …" : "Offline · Sync vorgemerkt", "pending");
  try {
    await services.firestoreApi.setDoc(cloudDocument, {
      ...cloudPayload(),
      updatedAt: services.firestoreApi.serverTimestamp()
    });
    if (revisionAtStart === localRevision) {
      unsyncedChanges = false;
      setSyncStatus("Synchronisiert", "success");
    } else {
      needsFollowUp = true;
    }
    return true;
  } catch (error) {
    unsyncedChanges = true;
    handleSyncError(error);
    return false;
  } finally {
    cloudWriteInProgress = false;
    if (needsFollowUp) scheduleCloudSync();
  }
}

async function loadCloudDataManually() {
  if (!ensureCloudReady()) return;
  if (!window.confirm(
    "Cloud-Daten laden und den aktuellen lokalen Stand auf diesem Gerät ersetzen?"
  )) return;
  setSyncStatus("Cloud-Daten werden geladen …", "pending");
  try {
    const snapshot = await services.firestoreApi.getDoc(cloudDocument);
    if (!snapshot.exists()) {
      setSyncStatus("Cloud-Daten leer", "local");
      showNotice("data-notice", "In der Cloud sind noch keine Daten vorhanden.", true);
      return;
    }
    applyCloudData(snapshot.data());
    showNotice("data-notice", "Cloud-Daten wurden geladen.");
  } catch (error) {
    handleSyncError(error);
  }
}

async function overwriteCloudData() {
  if (!ensureCloudReady()) return;
  if (!window.confirm(
    "Den aktuellen lokalen Stand vollständig in die Cloud schreiben und dortige Daten ersetzen?"
  )) return;
  unsyncedChanges = true;
  if (await pushDataToCloud()) showNotice("data-notice", "Cloud-Daten wurden überschrieben.");
}

async function deleteCloudData() {
  if (!ensureCloudReady()) return;
  if (!window.confirm(
    "Cloud-Daten wirklich löschen? Die lokalen Daten auf diesem Gerät bleiben erhalten."
  )) return;
  if (!window.confirm(
    `Letzte Bestätigung: Das Firestore-Dokument users/${currentUser.uid}/data/main endgültig löschen?`
  )) return;
  try {
    clearTimeout(syncTimer);
    syncTimer = null;
    unsyncedChanges = false;
    await services.firestoreApi.deleteDoc(cloudDocument);
    setSyncStatus("Cloud-Daten gelöscht", "local");
    showNotice("data-notice", "Cloud-Daten wurden gelöscht. Lokale Daten bleiben erhalten.");
  } catch (error) {
    handleSyncError(error);
  }
}

function ensureCloudReady() {
  if (currentUser && syncReady && cloudDocument) return true;
  showNotice("data-notice", "Bitte zuerst bei Firebase anmelden.", true);
  setSyncStatus("Anmeldung erforderlich", "local");
  return false;
}

function updateSyncControls() {
  const available = Boolean(currentUser && services);
  ["sync-now", "cloud-load", "cloud-overwrite", "cloud-delete"].forEach(id => {
    const button = document.getElementById(id);
    if (button) button.disabled = !available;
  });
}

function exportData() {
  saveLocalCache();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `gym-tracker-backup-${localDateString(new Date())}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showNotice("data-notice", "Backup wurde erstellt.");
}

async function importData(event) {
  const input = event.currentTarget;
  const file = input.files && input.files[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!parsed || ![1, 2].includes(Number(parsed.version)) ||
        !Array.isArray(parsed.workouts) || !Array.isArray(parsed.bodyweight) ||
        !parsed.draftWorkout || typeof parsed.draftWorkout !== "object") {
      throw new Error("Ungültige Datenstruktur");
    }
    if (!window.confirm("Importieren und alle vorhandenen Daten ersetzen?")) return;
    data = normalizeData(parsed);
    saveData();
    notifyDataListeners();
    showNotice("data-notice", "Daten erfolgreich importiert.");
  } catch (error) {
    console.warn("Import fehlgeschlagen.", error);
    showNotice("data-notice", "Die Datei ist kein gültiges Gym-Tracker-Backup.", true);
  } finally {
    input.value = "";
  }
}

function deleteLocalData() {
  if (!window.confirm(
    "Wirklich nur die lokalen Daten auf diesem Gerät löschen? Cloud-Daten bleiben erhalten."
  )) return;
  clearTimeout(syncTimer);
  syncTimer = null;
  unsyncedChanges = false;
  data = emptyData();
  saveLocalCache();
  notifyDataListeners();
  showNotice("data-notice", "Lokale Daten wurden gelöscht. Cloud-Daten bleiben erhalten.");
}

function reloadExcelData() {
  if (!window.confirm(
    "Excel-Importdaten erneut laden und alle aktuell gespeicherten Daten ersetzen?"
  )) return;
  data = normalizeData(cloneExcelSeedData());
  saveData();
  notifyDataListeners();
  showNotice("data-notice", "Excel-Importdaten wurden neu geladen.");
}

function summaryValue(value, label) {
  const element = document.createElement("span");
  const strong = document.createElement("strong");
  strong.textContent = value;
  element.append(strong, document.createTextNode(label));
  return element;
}

// Mapping der früheren Excel-Blätter in den unveränderten Version-2-Datensatz.
function isoWeekDate(year, week, weekday) {
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const januaryFourthDay = januaryFourth.getUTCDay() || 7;
  januaryFourth.setUTCDate(
    januaryFourth.getUTCDate() - januaryFourthDay + 1 + (week - 1) * 7 + (weekday - 1)
  );
  return januaryFourth.toISOString().slice(0, 10);
}

function makeExcelWorkout(dayKey, week, compactExercises) {
  const date = isoWeekDate(2026, week, TRAINING_PLAN[dayKey].weekday);
  return {
    id: `excel-${dayKey}-kw${String(week).padStart(2, "0")}`,
    date,
    completedAt: `${date}T12:00:00.000Z`,
    trainingDay: dayKey,
    trainingDayLabel: TRAINING_PLAN[dayKey].label,
    exercises: compactExercises.map(([exerciseIndex, sets]) => ({
      name: TRAINING_PLAN[dayKey].exercises[exerciseIndex].name,
      sets: sets.map(([reps, weight]) => ({ reps, weight }))
    }))
  };
}

function makeExcelBodyweight(week, weight) {
  return {
    id: `excel-bodyweight-kw${String(week).padStart(2, "0")}`,
    date: isoWeekDate(2026, week, 1),
    weight
  };
}

const EXCEL_SEED_DATA = {
  version: 1,
  workouts: [
    makeExcelWorkout("monday", 9, [[0,[[8,32.5],[6,32.5],[8,25]]],[1,[[10,0],[10,0],[12,0]]],[3,[[11,14],[7,14]]],[4,[[12,73],[12,73],[12,73]]],[5,[[20,40],[12,50],[10,50]]]]),
    makeExcelWorkout("monday", 10, [[0,[[8,32.5],[8,32.5],[6,32.6]]],[1,[[10,0],[11,0],[12,0]]],[2,[[12,73],[10,86]]],[3,[[15,15],[10,20]]],[4,[[12,80],[12,80],[12,80]]],[5,[[15,45],[12,50],[10,50]]]]),
    makeExcelWorkout("monday", 11, [[0,[[8,32.5],[8,32.5],[7,32.5]]],[1,[[10,0],[15,0],[12,0]]],[2,[[12,86],[8,93]]],[3,[[5,18],[10,14]]],[4,[[12,80],[8,80],[10,80]]],[5,[[20,40],[12,50],[12,50]]]]),
    makeExcelWorkout("monday", 12, [[0,[[7,32.5],[8,32.5],[7,32.5]]],[1,[[15,0],[15,0],[20,0]]],[2,[[7,93],[12,86]]],[3,[[15,20],[7,25]]],[4,[[12,80],[12,80],[10,80]]],[5,[[20,40],[12,50],[12,50]]]]),
    makeExcelWorkout("monday", 13, [[0,[[8,32.5],[8,32.5],[7,32.5]]],[1,[[15,0],[12,0],[12,0]]],[2,[[12,86],[9,86]]],[3,[[6,18],[8,16]]],[4,[[12,80],[12,80],[12,80]]],[5,[[20,40],[10,55],[12,50]]]]),
    makeExcelWorkout("monday", 14, [[0,[[8,35],[7,35],[5,35]]],[1,[[12,10],[12,10],[12,10]]],[2,[[12,86],[8,86]]],[3,[[12,14],[8,16]]],[4,[[12,85],[10,85],[8,85]]],[5,[[20,40],[11,55],[8,55]]]]),
    makeExcelWorkout("monday", 15, [[0,[[8,22.5],[8,22.5]]],[1,[[10,0],[10,0]]],[2,[[10,59],[10,59]]],[3,[[10,9],[10,9]]],[4,[[10,60],[8,60],[8,60]]],[5,[[15,35],[10,35]]]]),
    makeExcelWorkout("monday", 17, [[0,[[8,32.5],[6,32.5],[8,27.5]]],[1,[[12,null],[12,null],[12,null]]],[2,[[8,86],[8,79]]],[3,[[12,11],[9,11]]],[4,[[12,80],[12,80],[10,80]]],[5,[[20,45],[10,55],[12,50]]]]),
    makeExcelWorkout("monday", 19, [[0,[[8,32.5],[7,32.5],[6,32.5]]],[1,[[12,null],[12,null],[12,null]]],[2,[[8,79],[9,78]]],[3,[[9,12],[8,12]]],[4,[[12,80],[12,80],[10,80]]],[5,[[15,40],[10,55],[10,55]]]]),
    makeExcelWorkout("monday", 20, [[0,[[8,30],[8,35],[8,35]]],[1,[[12,null],[12,null],[12,null]]],[2,[[8,86],[8,86]]],[3,[[9,12],[8,12]]],[4,[[12,80],[12,80],[11,80]]],[5,[[12,50],[12,50],[12,50]]]]),
    makeExcelWorkout("monday", 21, [[0,[[8,35],[8,35],[8,35]]],[1,[[15,null],[12,null],[10,null]]],[2,[[8,86],[7,86]]],[3,[[5,25],[10,20]]],[4,[[10,100],[8,110],[4,120]]],[5,[[10,60],[6,60],[12,50]]]]),
    makeExcelWorkout("monday", 23, [[0,[[4,37.5],[4,30]]],[1,[[15,null],[15,null],[15,null]]],[2,[[8,86],[8,86]]],[3,[[10,16],[8,16]]],[4,[[12,90],[12,90],[12,90]]],[5,[[10,50],[10,60],[10,55]]]]),
    makeExcelWorkout("monday", 26, [[0,[[10,35],[6,37.5],[6,37.5]]],[1,[[12,null],[12,null],[12,null]]],[2,[[8,86],[8,86]]],[3,[[10,20],[10,20]]],[4,[[8,120],[8,120],[10,80]]],[5,[[10,50],[10,60],[10,50]]]]),
    makeExcelWorkout("monday", 27, [[0,[[8,37.5],[5,37.5],[10,30]]],[2,[[12,86],[8,100],[12,79]]],[3,[[8,18],[10,18]]],[4,[[8,100],[10,100],[8,100]]],[5,[[10,55],[10,55]]]]),
    makeExcelWorkout("tuesday", 9, [[0,[[9,60],[8,60],[6,60]]],[1,[[8,70],[8,70],[8,70]]],[2,[[6,120],[6,120]]],[3,[[10,66],[10,66]]],[4,[[12,36],[14,36]]],[5,[[10,23],[7,23]]],[6,[[6,null],[6,null],[6,null]]]]),
    makeExcelWorkout("tuesday", 10, [[0,[[10,60],[8,60],[7,60]]],[1,[[9,70],[8,70],[8,70]]],[2,[[10,100],[10,110]]],[3,[[8,68],[15,66]]],[4,[[12,36],[15,41]]],[5,[[10,23],[10,23]]],[6,[[8,null],[8,null],[7,null]]]]),
    makeExcelWorkout("tuesday", 11, [[0,[[12,45],[8,60],[8,60]]],[1,[[12,70],[10,70],[10,70]]],[2,[[8,80],[15,80]]],[3,[[10,75],[12,75]]],[4,[[12,55],[12,60]]],[5,[[12,25],[8,25]]],[6,[[9,null],[8,null],[8,null]]]]),
    makeExcelWorkout("tuesday", 12, [[0,[[12,50],[9,60],[9,60]]],[1,[[12,60],[8,80],[9,70]]],[2,[[12,60],[12,60]]],[3,[[12,75],[12,75]]],[4,[[12,59],[12,59]]],[5,[[7,20],[8,20]]],[6,[[8,null],[7,null],[7,null]]]]),
    makeExcelWorkout("tuesday", 13, [[0,[[10,60],[8,65],[6,65]]],[1,[[8,70],[9,70],[10,60]]],[2,[[12,100],[10,100]]],[3,[[8,80],[12,70]]],[4,[[12,59],[12,58]]],[5,[[12,18],[10,20]]],[6,[[7,null],[6,null],[6,null]]]]),
    makeExcelWorkout("tuesday", 14, [[0,[[8,65],[7,65],[9,60]]],[1,[[9,70],[8,70],[9,70]]],[2,[[10,100],[10,100]]],[3,[[10,75],[10,75]]],[4,[[12,60],[12,60]]],[5,[[12,25],[12,25]]],[6,[[6,null],[6,null],[6,null]]]]),
    makeExcelWorkout("tuesday", 15, [[0,[[10,40],[8,40],[8,40]]],[1,[[10,45],[8,45],[8,45]]],[2,[[10,60],[10,60]]],[3,[[8,52],[8,52]]],[4,[[10,41],[10,41]]],[5,[[10,16],[10,16]]]]),
    makeExcelWorkout("tuesday", 17, [[1,[[8,70],[8,70],[8,70]]],[2,[[6,100],[6,100]]],[3,[[12,60],[8,75]]],[4,[[12,59],[12,59]]],[5,[[12,18],[12,18]]],[6,[[6,null],[6,null],[6,null]]]]),
    makeExcelWorkout("tuesday", 19, [[0,[[8,60],[8,65],[8,60]]],[1,[[7,70],[8,70],[8,70]]],[2,[[12,60],[12,60]]],[3,[[12,73],[12,73]]],[4,[[12,70],[12,60]]],[5,[[12,25],[9,30]]],[6,[[6,null],[6,null],[6,null]]]]),
    makeExcelWorkout("tuesday", 20, [[0,[[6,65],[5,60],[8,40]]],[1,[[8,75],[8,75],[10,60]]],[2,[[12,60],[12,60]]],[3,[[11,73],[11,73]]],[4,[[11,64],[12,64]]],[5,[[8,23],[8,23]]],[6,[[6,null],[6,null],[6,null]]]]),
    makeExcelWorkout("tuesday", 21, [[0,[[8,60],[8,60],[9,60]]],[1,[[8,70],[9,70],[7,75]]],[2,[[8,80],[8,80]]],[3,[[12,73],[12,73]]],[4,[[12,70],[9,85]]],[5,[[10,30],[8,30]]],[6,[[6,null],[6,null],[6,null]]]]),
    makeExcelWorkout("tuesday", 23, [[0,[[10,60],[7,70],[7,70]]],[1,[[10,80],[8,80],[7,80]]],[2,[[10,80],[10,80]]],[3,[[12,79],[8,79]]],[4,[[8,73],[12,68]]],[5,[[7,23],[7,23]]],[6,[[6,null],[6,null],[6,null]]]]),
    makeExcelWorkout("tuesday", 24, [[1,[[12,80],[10,80],[8,70]]]]),
    makeExcelWorkout("tuesday", 26, [[0,[[8,60],[5,70],[8,60]]],[1,[[8,85],[6,85],[11,65]]],[2,[[5,120],[7,120]]],[4,[[12,68],[12,68]]],[5,[[9,23],[8,23]]],[6,[[6,null],[6,null],[6,null]]]]),
    makeExcelWorkout("tuesday", 27, [[1,[[12,80],[8,85],[8,85]]],[2,[[2,140],[2,140]]],[3,[[12,66],[12,66]]],[4,[[10,80],[10,70]]],[5,[[9,23],[8,23]]]]),
    makeExcelWorkout("thursday", 9, [[0,[[10,60],[12,60],[10,60]]],[1,[[12,20],[10,25]]],[2,[[17,12.5],[11,15]]],[3,[[15,40],[11,50]]],[4,[[12,32],[8,36]]]]),
    makeExcelWorkout("thursday", 10, [[0,[[12,60],[11,60],[9,60]]],[1,[[12,20],[10,25]]],[2,[[12,15],[11,15]]],[3,[[12,50],[9,60]]],[4,[[12,36],[9,41]]]]),
    makeExcelWorkout("thursday", 11, [[0,[[8,70],[12,60],[8,60]]],[1,[[8,25],[10,25]]],[2,[[15,15],[10,17.5]]],[3,[[15,55],[10,55]]],[4,[[12,41],[9,41]]]]),
    makeExcelWorkout("thursday", 12, [[0,[[11,60],[9,65],[6,60]]],[1,[[12,20],[10,30]]],[2,[[12,15],[10,15]]],[3,[[10,55],[20,45]]],[4,[[12,41],[8,41]]]]),
    makeExcelWorkout("thursday", 13, [[0,[[12,60],[12,60],[11,60]]],[1,[[12,25],[8,30]]],[2,[[15,15],[11,15]]],[3,[[7,50],[8,41]]],[4,[[12,41],[8,41]]]]),
    makeExcelWorkout("thursday", 19, [[0,[[12,60],[11,60],[9,60]]],[1,[[8,20],[12,25]]],[2,[[15,15],[10,15]]],[3,[[8,null]]],[4,[[12,36],[10,41]]]]),
    makeExcelWorkout("thursday", 20, [[0,[[12,60],[10,60],[10,60]]],[1,[[6,25],[6,25]]],[2,[[12,15],[10,17.5]]],[3,[[12,50],[8,60]]],[4,[[10,45],[8,45]]]]),
    makeExcelWorkout("thursday", 21, [[0,[[12,60],[10,65],[10,65]]],[1,[[12,30],[7,32.5]]],[2,[[10,17.5],[8,20]]],[3,[[8,60],[10,60]]],[4,[[12,45],[8,45]]]]),
    makeExcelWorkout("thursday", 23, [[0,[[10,60],[12,60],[8,60]]],[1,[[12,30],[8,40]]],[2,[[8,20],[8,20]]],[3,[[10,60],[12,68]]],[4,[[11,45],[8,45]]]]),
    makeExcelWorkout("thursday", 27, [[0,[[12,60],[10,65],[10,65]]],[1,[[6,40],[8,30]]],[2,[[8,20],[8,20]]],[3,[[10,85],[10,85]]],[4,[[12,45],[12,45]]]]),
    makeExcelWorkout("friday", 9, [[0,[[15,160],[15,200]]],[1,[[12,70],[10,80]]],[2,[[15,65],[15,75]]],[3,[[12,39],[15,39]]],[4,[[10,50],[10,50],[10,50]]]]),
    makeExcelWorkout("friday", 10, [[0,[[14,200],[10,220]]],[1,[[10,75],[10,75]]],[2,[[15,75],[15,85]]],[3,[[12,45],[12,45]]],[4,[[10,55],[10,55],[10,55]]],[5,[[20,60],[14,70],[30,60]]]]),
    makeExcelWorkout("friday", 11, [[0,[[10,220],[8,240]]],[1,[[12,80],[9,80]]],[2,[[15,90],[8,100]]],[3,[[12,52],[12,52]]],[4,[[12,40],[12,40],[12,40]]],[5,[[20,60],[12,60],[25,50]]]]),
    makeExcelWorkout("friday", 12, [[0,[[12,200],[12,200]]],[1,[[10,75],[12,75]]]]),
    makeExcelWorkout("friday", 13, [[0,[[12,200],[12,200]]],[1,[[12,75],[10,75]]],[2,[[10,90],[8,90]]],[3,[[12,45],[12,45]]],[4,[[12,40],[12,40],[12,40]]],[5,[[20,50],[15,60],[10,60]]]]),
    makeExcelWorkout("friday", 19, [[0,[[12,160],[12,160]]],[1,[[12,75],[12,75]]],[2,[[12,73],[12,73]]],[3,[[12,39],[12,39]]],[4,[[12,40],[12,40],[12,40]]],[5,[[20,50],[20,50],[15,50]]]]),
    makeExcelWorkout("friday", 20, [[0,[[12,200],[12,200]]],[1,[[12,85],[9,90]]],[2,[[12,75],[12,75]]],[3,[[12,47],[12,47]]],[4,[[10,60],[12,60],[10,60]]],[5,[[20,null]]]]),
    makeExcelWorkout("friday", 23, [[0,[[8,200],[5,200]]],[1,[[6,110],[8,90]]],[2,[[12,79],[9,79]]],[3,[[8,52],[8,52]]]]),
    makeExcelWorkout("saturday", 9, [[0,[[10,22.5],[10,22.5],[10,22.5]]],[1,[[10,30],[9,35],[7,35]]],[2,[[11,66],[7,73],[6,68]]],[3,[[10,15],[15,12.5],[15,12.5]]],[4,[[20,20],[20,20],[12,40]]]]),
    makeExcelWorkout("saturday", 10, [[0,[[10,22.5],[10,22.5],[8,22.5]]],[1,[[9,30],[8,30],[8,30]]],[2,[[8,66],[8,66],[6,66]]],[3,[[10,15],[10,15],[15,12.5]]],[4,[[20,20],[12,40],[12,40]]]]),
    makeExcelWorkout("saturday", 11, [[0,[[12,22.5],[10,25],[12,25]]],[1,[[10,30],[10,30],[10,30]]],[2,[[8,66],[11,59],[10,61]]],[3,[[25,10],[8,15],[13,11.5]]],[4,[[12,40],[12,40],[13,40]]]]),
    makeExcelWorkout("saturday", 12, [[1,[[10,30],[10,30],[10,30]]],[2,[[11,75],[8,75],[10,75]]],[3,[[25,10],[12,15],[12,15]]],[4,[[8,40],[8,40],[8,40]]]]),
    makeExcelWorkout("saturday", 13, [[0,[[8,25],[12,25],[9,25]]],[1,[[12,30],[8,35],[8,35]]],[2,[[8,75],[7,85],[7,85]]],[3,[[25,10],[9,15],[8,15]]],[4,[[12,null],[12,null],[12,null]]]]),
    makeExcelWorkout("saturday", 19, [[0,[[12,22.5],[12,22.5],[12,25]]],[1,[[12,30],[10,35],[12,35]]],[2,[[10,73],[10,73],[8,66]]],[3,[[15,10],[8,15],[10,15]]]]),
    makeExcelWorkout("saturday", 20, [[0,[[10,27.5],[10,27.5],[7,27.5]]],[1,[[9,35],[10,35],[8,35]]],[2,[[10,66],[9,66],[8,79]]],[3,[[25,10],[6,17.5],[15,12.5]]]]),
    makeExcelWorkout("saturday", 21, [[0,[[6,30],[6,30],[6,30]]],[1,[[8,40],[8,40],[8,40]]],[2,[[8,80],[6,80],[8,66]]],[3,[[12,15],[12,15],[8,12.5]]]]),
    makeExcelWorkout("saturday", 23, [[0,[[6,30],[6,30],[8,30]]],[1,[[8,40],[5,42.5],[7,42.5]]],[2,[[6,79],[6,79],[8,66]]],[3,[[25,10],[10,15],[8,15]]]]),
    makeExcelWorkout("saturday", 27, [[0,[[8,30],[8,30],[4,30]]],[1,[[8,40],[6,40],[12,30]]],[2,[[7,79],[6,86],[6,86]]],[3,[[10,15],[12,15],[12,15]]],[4,[[12,20],[12,20],[12,20]]]])
  ],
  bodyweight: [
    makeExcelBodyweight(9, 80.2),
    makeExcelBodyweight(10, 81),
    makeExcelBodyweight(11, 81.2),
    makeExcelBodyweight(12, 81.3),
    makeExcelBodyweight(13, 82.4),
    makeExcelBodyweight(23, 83.3),
    makeExcelBodyweight(24, 81.7),
    makeExcelBodyweight(27, 83)
  ],
  draftWorkout: { selectedDay: "monday", days: {} }
};

function cloneExcelSeedData() {
  return JSON.parse(JSON.stringify(EXCEL_SEED_DATA));
}

// Erst initialisieren, nachdem die eingebetteten Excel-Seed-Konstanten stehen.
data = loadData();
