import {getHostname} from '/hostname.js';

(async () => {
    try {
        // Get the hostname of the server
        const hostname = await getHostname();

        // Check if the user is an admin
        const isAdmin = await checkAdmin(hostname);
        if (!isAdmin) {
            // Redirect to the login page if not an admin
            window.location.href = '/login/';
            return;
        }

        // Load all records if the user is an admin
        await getAllRecords(hostname);

        // Bind event listeners
        bindEventListeners(hostname);

    } catch (error) {
        console.error('Initialization error:', error);
        alert('An error occurred during initialization. Please try again later.');
    }
})();

/**
 * Check if the user is an admin
 * @param {string} hostname - The hostname of the server
 * @returns {Promise<boolean>} Return if the user is an admin
 */
async function checkAdmin(hostname) {
    const response = await fetch(`${hostname}/api/v1/admin_check`, {
        method: 'GET',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        credentials: 'include'
    });
    const data = await response.json();
    // If data.status === false, it means the user is not an admin
    return data.status !== false;
}

/**
 * Get all records and render them to the page
 * @param {string} hostname
 */
async function getAllRecords(hostname) {
    try {
        const response = await fetch(`${hostname}/api/v1/get_all_records`, {
            method: 'GET',
            credentials: 'include',
        });
        const data = await response.json();

        // If the backend returns status === false, it means the login has expired, redirect to the login page
        if (data.status === false) {
            window.location.href = '/login/';
            return;
        }

        // Render the data obtained to the page
        renderRecord(hostname, data['data']['records']);
    } catch (error) {
        console.error('Error getting all records:', error);
        alert('Failed to retrieve records. Please try again later.');
    }
}

/**
 * Bind button and form events on the page
 * @param {string} hostname - Server hostname
 */
function bindEventListeners(hostname) {
    // Bind the event of Purge All button
    document.querySelectorAll('.js-purge-all-button').forEach((button) => {
        button.addEventListener('click', async () => {
            try {
                const response = await fetch(`${hostname}/api/v1/purge_all_records`, {
                    method: 'DELETE',
                    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                    credentials: 'include',
                });
                const data = await response.json();
                if (data.status) {
                    alert('Purged everything!');
                    window.location.reload();
                } else {
                    alert('Failed to purge records.');
                }
            } catch (error) {
                console.error('Error purging all records:', error);
                alert('An error occurred while purging records.');
            }
        });
    });

    // Bind the event of Search-Delete button
    document.querySelectorAll('.js-search-delete-button').forEach((button) => {
        button.addEventListener('click', () => {
            doSearchDeleteButtonAction(hostname);
        });
    });

    // Bind the form submission event
    const formElement = document.querySelector('form');
    if (formElement) {
        formElement.addEventListener('submit', (event) => {
            event.preventDefault();
            doSearchDeleteButtonAction(hostname);
        });
    }
}

/**
 * Render the record list to the page
 * @param {string} hostname - Server hostname
 * @param {object} data - All record data returned by the API (key-value)
 */
function renderRecord(hostname, data) {
    let displayHTML = `
            <div class="list-grid">
                <div class="header">Original</div>
                <div id="list-grid-short" class="header">Short</div>
                <div class="header">Action</div>
            </div>
        `;

    // Render each record as a DOM structure
    for (const [orig, short] of Object.entries(data)) {
        displayHTML += `
                <div class="list-grid">
                    <div class="list-grid-original">
                        <a href="${orig}" target="_blank">${orig}</a>
                    </div>
                    <div class="short-url-in-list-grid">${short}</div>
                    <div>
                        <button
                            type="button"
                            class="short-delete-button js-delete-url-button"
                            data-short-url="${short}"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            `;
    }

    // If there are no records, prompt the user that there's none
    if (!Object.keys(data).length) {
        displayHTML = `<div class="text-color">No records found.</div>`;
        document.querySelector('.js-search-delete-field-div').innerHTML = `
                <input type="text" class="js-search-delete-field cursor-ban" id="delete-field" readonly/>
                <button type="button" class="button-force-hover cursor-ban js-search-delete-button">Delete</button>
            `;
    }

    // Insert the generated HTML into the specified container
    const recordsContainer = document.querySelector('.js-display-records');
    if (recordsContainer) {
        recordsContainer.innerHTML = displayHTML;

        // Bind the delete button events
        recordsContainer.querySelectorAll('.js-delete-url-button').forEach((button) => {
            button.addEventListener('click', () => {
                const delShort = button.dataset.shortUrl;
                doSearchDelete(hostname, delShort, 'assigned');
            });
        });
    }
}

/**
 * Delete the specified record
 * @param {string} hostname - Server hostname
 * @param {string} delUrl - Short URL to delete
 * @param {string} method - Source method ('search' or 'assigned')
 */
async function doSearchDelete(hostname, delUrl, method) {
    // Remove the base URL if it exists
    delUrl = remove_baseURL_if_exist(hostname, delUrl);

    // Send a request to delete the record
    try {
        const response = await fetch(`${hostname}/api/v1/delete_record`, {
            method: 'DELETE',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: new URLSearchParams({url: delUrl}).toString(),
            credentials: 'include',
        });
        const data = await response.json();

        // If the backend failed to return
        if (!data.status) {
            if (method === 'search') {
                alert('The record does not exist.');
            } else {
                alert('Something went wrong, the page will be refreshed!\nClick OK to continue.');
            }
        } else if (method === 'search') {
            // If search delete success
            alert('Record deleted successfully!');
        }

        // Refresh the record list
        await getAllRecords(hostname);
    } catch (error) {
        console.error('Error deleting record:', error);
        alert('An error occurred while deleting the record. Please try again.');
    }
}

/**
 * Called by the "Search Delete" form and button
 * @param {string} hostname - Server hostname
 */
function doSearchDeleteButtonAction(hostname) {
    const field = document.querySelector('.js-search-delete-field');
    if (!field) return;

    const delUrl = field.value.trim();
    if (!delUrl) return;

    doSearchDelete(hostname, delUrl, 'search');
    field.value = '';
}

/**
 * Remove the base URL if it exists
 * @param {string} hostname - Server hostname (may include http://, https:// or just domain itself)
 * @param {string} url - The URL to be dealt with
 * @return {string} - The URL after removing the hostname (if existed)
 */
function remove_baseURL_if_exist(hostname, url) {
    // Get rid of the protocol part of the hostname
    const hostnameNoProtocol = hostname.replace(/^https?:\/\//, '');

    // Replace all special characters in the hostname with an escape character
    const escapedHost = hostnameNoProtocol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // (3) Create the regex:
    //     ^                -> Matches the beginning of the string
    //     (?:https?:\/\/)? -> Optional http:// or https:// (not capturing group)
    //     Then append the escaped hostname (including possible port), using 'i' to ignore case
    const pattern = new RegExp('^(?:https?:\\/\\/)?' + escapedHost, 'i');

    // Do the replacement
    return url.replace(pattern, '');
}
