// auth.js – shared authentication helpers

/**
 * Redirects to the access code page if the user has not yet entered the site code.
 * Call this synchronously (not in DOMContentLoaded) at the top of any guarded page's script.
 * Note: each guarded page also has an early inline <head> check to prevent content flash.
 */
function checkSiteAccess() {
  if (!localStorage.getItem("site_access")) {
    window.location.replace("access.html");
  }
}

/**
 * Returns the currently signed-in Supabase user, or null.
 */
async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Returns true if the current user's email is in ADMIN_EMAILS.
 */
async function isAdmin() {
  const user = await getCurrentUser();
  if (!user || !user.email) return false;
  return ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(user.email.toLowerCase());
}

/**
 * Updates the navbar:
 * - Shows the admin's email and Sign Out button when an admin is signed in.
 * - Shows the Admin Login link when no admin session is active.
 * - Toggles the Admin nav link based on admin status.
 * Regular users never sign in — the Admin Login link is only for administrators.
 */
async function updateNav() {
  const user      = await getCurrentUser();
  const userEl    = document.getElementById("nav-user-email");
  const signInEl  = document.getElementById("nav-signin");
  const signOutEl = document.getElementById("nav-signout");
  const adminEl   = document.getElementById("nav-admin");

  if (user) {
    if (userEl)    userEl.textContent = user.email ?? "";
    if (signInEl)  signInEl.classList.add("d-none");
    if (signOutEl) signOutEl.classList.remove("d-none");
    const admin = await isAdmin();
    if (adminEl) adminEl.classList.toggle("d-none", !admin);
  } else {
    if (userEl)    userEl.textContent = "";
    if (signInEl)  signInEl.classList.remove("d-none");
    if (signOutEl) signOutEl.classList.add("d-none");
    if (adminEl)   adminEl.classList.add("d-none");
  }
}

/**
 * Signs the admin out and redirects to the home page.
 */
async function signOut() {
  await supabase.auth.signOut();
  window.location.replace("index.html");
}
