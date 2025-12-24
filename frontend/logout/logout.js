import {getHostname} from '/hostname.js';

(async () => {
    // Get the hostname of the server
    const hostname = await getHostname();

    // Logout the user
    await doLogout(hostname);
})();

/**
 * Logout the user
 * @param {string} hostname - The hostname of the server
 */
async function doLogout(hostname) {
    try {
        const response = await fetch(`${hostname}/api/v1/logout`, {
            method: 'POST',
            credentials: 'include',
        });
        const data = await response.json();
        window.location.href = '/';
    } catch (error) {
        console.error('Error during logout:', error);
    }
}