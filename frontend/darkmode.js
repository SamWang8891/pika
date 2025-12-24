// Get the item darkmode from localStorage
let darkMode = localStorage.getItem('darkmode');

// If the darkmode is previously set to active, activate dark mode
if (darkMode === "active") {
    enableDarkMode();
}

// Add event listener to the theme switch button
document.getElementById('theme-switch').addEventListener('click', () => {
    if (!(location.pathname === '/' && document.getElementById('qrcode'))) {
        darkMode = localStorage.getItem('darkmode');
        darkMode !== "active" ? enableDarkMode() : disableDarkMode();
    }
})

/**
 * Enable dark mode
 */
function enableDarkMode() {
    document.body.classList.add('darkmode');
    localStorage.setItem('darkmode', 'active');
}

/**
 * Disable dark mode
 */
function disableDarkMode() {
    document.body.classList.remove('darkmode');
    localStorage.setItem('darkmode', null);
}
