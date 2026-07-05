/* Firebase-Login, Logout und dauerhaft gespeicherte Auth-Session. */

import { showNotice } from "./utils.js";

let services = null;
let callbacks = null;

export async function initializeAuth(firebaseServices, authCallbacks) {
  services = firebaseServices;
  callbacks = authCallbacks;
  updateAuthUI(null);

  document.getElementById("firebase-login-form")
    .addEventListener("submit", login);
  document.getElementById("firebase-logout")
    .addEventListener("click", logout);

  await services.authApi.setPersistence(
    services.auth,
    services.authApi.browserLocalPersistence
  );
  services.authApi.onAuthStateChanged(services.auth, user => {
    updateAuthUI(user);
    Promise.resolve(callbacks.onUserChanged(user)).catch(callbacks.onError);
  });
}

async function login(event) {
  event.preventDefault();
  const email = document.getElementById("firebase-email").value.trim();
  const passwordInput = document.getElementById("firebase-password");
  callbacks.onStatus("Anmeldung läuft …", "pending");
  try {
    await services.authApi.signInWithEmailAndPassword(
      services.auth,
      email,
      passwordInput.value
    );
    passwordInput.value = "";
  } catch (error) {
    passwordInput.value = "";
    console.warn("Firebase-Anmeldung fehlgeschlagen.", error);
    callbacks.onStatus("Anmeldung fehlgeschlagen", "error");
    showNotice("data-notice", "Anmeldung fehlgeschlagen. E-Mail und Passwort prüfen.", true);
  }
}

async function logout() {
  try {
    await services.authApi.signOut(services.auth);
  } catch (error) {
    callbacks.onError(error);
  }
}

function updateAuthUI(user) {
  const form = document.getElementById("firebase-login-form");
  const info = document.getElementById("firebase-auth-info");
  const userLabel = document.getElementById("firebase-user");
  form.hidden = Boolean(user);
  info.hidden = !user;
  userLabel.textContent = user ? `Angemeldet als ${user.email || user.uid}` : "";
}
