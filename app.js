/* App-Start, Navigation und Zusammenschaltung aller Feature-Module. */

import { initializeFirebase } from "./firebase.js";
import { initializeAuth } from "./auth.js";
import {
  connectFirebaseStorage,
  handleAuthChange,
  handleSyncError,
  initializeStorage,
  setSyncStatus,
  subscribeToData,
  updateDataSummary
} from "./storage.js";
import { initializeTraining, renderTraining } from "./training.js";
import { initializeHistory, renderHistory } from "./history.js";
import { initializeAnalytics, renderAnalytics } from "./analytics.js";
import { initializeBodyweight, renderBodyweight } from "./bodyweight.js";
import { clearTouchChartTooltips } from "./charts.js";

let activeView = "training";
let analyticsRefreshTimer = null;

function switchView(viewName) {
  activeView = viewName;
  document.querySelectorAll(".nav-button").forEach(button => {
    const active = button.dataset.view === viewName;
    button.classList.toggle("active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
  document.querySelectorAll(".view").forEach(view => {
    view.classList.toggle("active", view.id === `view-${viewName}`);
  });

  if (viewName === "history") renderHistory();
  if (viewName === "analytics") renderAnalytics();
  if (viewName === "bodyweight") renderBodyweight();
  if (viewName === "data") updateDataSummary();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderAll() {
  renderTraining();
  if (activeView === "history") renderHistory();
  if (activeView === "analytics") renderAnalytics();
  renderBodyweight();
  updateDataSummary();
}

async function initializeApp() {
  initializeTraining();
  initializeHistory(() => {
    clearTimeout(analyticsRefreshTimer);
    analyticsRefreshTimer = setTimeout(renderAnalytics, 120);
  });
  initializeAnalytics();
  initializeBodyweight();
  initializeStorage();
  subscribeToData(renderAll);

  document.querySelectorAll(".nav-button").forEach(button => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });
  window.addEventListener("resize", () => {
    if (activeView === "analytics") renderAnalytics();
    if (activeView === "bodyweight") renderBodyweight();
  });
  document.addEventListener("pointerdown", clearTouchChartTooltips);

  renderAll();
  const loginButton = document.getElementById("firebase-login");
  loginButton.disabled = true;
  setSyncStatus("Firebase wird geladen …", "pending");

  try {
    const firebaseServices = await initializeFirebase();
    connectFirebaseStorage(firebaseServices);
    loginButton.disabled = false;
    await initializeAuth(firebaseServices, {
      onUserChanged: handleAuthChange,
      onStatus: setSyncStatus,
      onError: handleSyncError
    });
  } catch (error) {
    loginButton.disabled = false;
    handleSyncError(error);
  }
}

initializeApp();
