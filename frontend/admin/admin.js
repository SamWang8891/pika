import {getApiHostname, getWebHostname} from '../hostname.js';
import {HTTP} from '../response.js'

// Get the API hostname of the server
const apiHostname = await getApiHostname();
const webHostname = await getWebHostname();

(async () => {
    try {
        // Check if the user is an admin
        const response = await fetch(`${apiHostname}/api/v2/admin_check`, {
            method: 'GET', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, credentials: 'include'
        });
        const data = await response.json();

        if (data.status === HTTP.UNAUTHORIZED) {
            // Redirect to the login page if not an admin
            window.location.href = '/login/';
            return;
        }

        // Load all records if the user is an admin
        await getAllRecords();

        // Bind event listeners
        bindEventListeners();

    } catch (error) {
        console.error('Initialization error:', error);
        window.location.href = '/login/';
    }
})();

/**
 * Get all records and render them to the page
 */
async function getAllRecords() {
    try {
        const response = await fetch(`${apiHostname}/api/v2/get_all_records`, {
            method: 'GET', credentials: 'include',
        });
        const data = await response.json();

        if (data.status === HTTP.UNAUTHORIZED) {
            window.location.href = '/login/';
            return;
        }

        // Render the data obtained to the page
        renderRecord(data['data']['records']);
    } catch (error) {
        console.error('Error getting all records:', error);
        alert('Failed to retrieve records. Please try again later.');
        window.location.href = '/login/';
    }
}

/**
 * Bind button and form events on the page
 */
function bindEventListeners() {
    // Bind the event of Purge All button
    document.querySelectorAll('.js-delete-all-button').forEach((button) => {
        button.addEventListener('click', async () => {
            try {
                const response = await fetch(`${apiHostname}/api/v2/delete_all_records`, {
                    method: 'DELETE',
                    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                    credentials: 'include',
                });
                const data = await response.json();
                if (data.status === HTTP.OK) {
                    alert(data.message);
                } else if (data.status === HTTP.UNAUTHORIZED) {
                    window.location.href = '/login/';
                } else {
                    alert ('Something went wrong' + data.message);
                }
            } catch (error) {
                console.error('Error purging all records:', error);
                alert('An error occurred while purging records.');
            }

            // Refresh the record list
            await getAllRecords();
        });
    });

    // Bind the event of Search-Delete button
    document.querySelectorAll('.js-search-delete-button').forEach((button) => {
        button.addEventListener('click', () => {
            doSearchDeleteButtonAction();
        });
    });

    // Bind the form submission event
    const formElement = document.querySelector('form');
    if (formElement) {
        formElement.addEventListener('submit', (event) => {
            event.preventDefault();
            doSearchDeleteButtonAction();
        });
    }
}

/**
 * Render the record list to the page
 * @param {Array} data - All record data returned by the API (array of objects with 'orig' and 'short')
 */
function renderRecord(data) {
    let displayHTML = `
            <div class="list-grid">
                <div class="header">Original</div>
                <div id="list-grid-short" class="header">Short</div>
                <div class="header">Action</div>
            </div>
        `;

    // Render each record as a DOM structure
    for (const record of data) {
        const {orig, short} = record;
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
    if (!data.length) {
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
                doSearchDelete(delShort);
            });
        });
    }
}

/**
 * Delete the specified record.
 * Hand in the short one if you know what to delete, or else if there's multiple short one pointing to the same original, deletion will fail.
 * @param {string} delUrl - Short URL to delete
 */
async function doSearchDelete(delUrl) {
    // Remove the base URL if it exists
    delUrl = remove_baseURL_if_exist(delUrl);

    // Send a request to delete the record
    try {
        const response = await fetch(`${apiHostname}/api/v2/delete_record`, {
            method: 'DELETE',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: new URLSearchParams({url: delUrl}).toString(),
            credentials: 'include',
        });
        const data = await response.json();

        if (data.status === HTTP.UNAUTHORIZED) {
            window.location.href = '/login/';
            return;
        }

        if (data.status === HTTP.OK) {
        } else if (data.status === HTTP.MULTIPLE_CHOICES) {
            alert('Multiple found, please specify.');
        } else if (data.status === HTTP.NOT_FOUND) {
            alert(data.message);
        } else {
            alert('Something went wrong' + data.message);
        }

        // Refresh the record list
        await getAllRecords();
    } catch (error) {
        console.error('Error deleting record:', error);
        alert('An error occurred while deleting the record. Please try again.');
    }
}

/**
 * Called by the "Search Delete" form and button
 */
function doSearchDeleteButtonAction() {
    const field = document.querySelector('.js-search-delete-field');
    if (!field) return;

    const delUrl = field.value.trim();
    if (!delUrl) return;

    doSearchDelete(delUrl);
    field.value = '';
}

/**
 * Remove the base URL if it exists
 * @param {string} url - The URL to be dealt with
 * @return {string} - The URL after removing the hostname (if existed)
 */
function remove_baseURL_if_exist(url) {
    // Get rid of the protocol part of the web hostname
    const webHostnameNoProtocol = webHostname.replace(/^https?:\/\//, '');

    // Replace all special characters in the web hostname with an escape character
    const escapedHost = webHostnameNoProtocol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Create the regex:
    //     ^                -> Matches the beginning of the string
    //     (?:https?:\/\/)? -> Optional http:// or https:// (not capturing group)
    //     Then append the escaped hostname (including possible port), using 'i' to ignore case
    const pattern = new RegExp('^(?:https?:\\/\\/)?' + escapedHost, 'i');

    // Do the replacement
    return url.replace(pattern, '');
}
