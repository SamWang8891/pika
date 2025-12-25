import {getApiHostname} from '../hostname.js';
import {HTTP} from "../response.js";

// Get the API hostname of the server
const apiHostname = await getApiHostname();


(async () => {
    await doLogout();
})();

/**
 * Logout the user
 * @param {string} hostname - The hostname of the server
 */
async function doLogout() {
    try {
        const response = await fetch(`${apiHostname}/api/v2/logout`, {
            method: 'POST',
            credentials: 'include',
        });
        const data = await response.json();

        if (data.status === HTTP.OK) {
            window.location.href = '/';
        } else {
            alert('Something went wrong. ' + data.message);
        }
    } catch (error) {
        console.error('Error during logout:', error);
    }
}