import {getApiHostname} from '../hostname.js';
import {HTTP} from '../response.js'
import {checkAdmin} from '../check_privilege.js'

// Get the API hostname of the server
const apiHostname = await getApiHostname();

(async () => {
    try {
        // Check if the user has admin privileges
        const isAdmin = await checkAdmin();
        if (!isAdmin) {
            window.location.href = '/login/';
            return;
        }

        // Render the button and bind the event
        renderButton();

        // Password visibility toggle
        const EYE_OPEN_PATH = 'M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Zm0-300Zm0 220q113 0 207.5-59.5T832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280Z';
        const EYE_CLOSED_PATH = 'm644-428-58-58q9-47-27-88t-93-32l-58-58q17-8 34.5-12t37.5-4q75 0 127.5 52.5T660-500q0 20-4 37.5T644-428Zm128 126-58-56q38-29 67.5-63.5T832-500q-50-101-143.5-160.5T480-720q-29 0-57 4t-55 12l-62-62q41-17 84-25.5t90-8.5q151 0 269 83.5T920-500q-23 59-60.5 109.5T772-302Zm20 246L624-222q-35 11-70.5 16.5T480-200q-151 0-269-83.5T40-500q21-53 53-98.5t73-81.5L56-792l56-56 736 736-56 56ZM222-624q-29 26-53 57t-41 67q50 101 143.5 160.5T480-280q20 0 39-2.5t39-5.5l-36-38q-11 3-21 4.5t-21 1.5q-75 0-127.5-52.5T300-500q0-11 1.5-21t4.5-21l-84-82Zm319 93Zm-151 75Z';

        document.querySelectorAll('.toggle-password').forEach((toggleButton) => {
            toggleButton.addEventListener('click', function() {
                const container = this.closest('.password-input-container');
                const input = container.querySelector('input');
                const eyeIcon = this.querySelector('.eye-icon path');

                if (input.type === 'password') {
                    input.type = 'text';
                    eyeIcon.setAttribute('d', EYE_CLOSED_PATH);
                } else {
                    input.type = 'password';
                    eyeIcon.setAttribute('d', EYE_OPEN_PATH);
                }
            });
        });

        // Bind the form submission event to change the password
        document.querySelector('form').addEventListener('submit', async function (event) {
            event.preventDefault(); // Prevent default submit
            await doChange();
        });
    } catch (error) {
        // Deal with errors globally, and display error message and log
        console.error('An error occurred:', error);
        alert('Something went wrong, please try again later.');
    }
})();


/**
 * Render the button to the page
 */
function renderButton() {
    document.querySelector('.js-button').innerHTML = `
            <button type="submit" class="js-submit-button">Change</button>
        `;
}


/**
 * Execute the password change request
 */
async function doChange() {
    // Get the entered password and confirmation password
    const password = document.querySelector('.js-new-pass-field').value;
    const password_confirm = document.querySelector('.js-new-pass-confirm-field').value;

    // Verify that the input is valid
    if (!(password && password_confirm)) {
        alert('Please fill in all fields');
        return;
    }
    if (password !== password_confirm) {
        alert('Password does not match');

        // Clear the input fields
        document.querySelector('.js-new-pass-field').value = '';
        document.querySelector('.js-new-pass-confirm-field').value = '';

        return;
    }

    try {
        // Send the password change request
        const response = await fetch(`${apiHostname}/api/v2/change_pass`, {
            method: 'POST', headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }, body: new URLSearchParams({new_pass: password}).toString(), credentials: 'include',
        });

        if (response.ok) {
            const data = await response.json();
            alert(data.message);
            window.location.href = '/login/';
        } else if (response.status === HTTP.UNAUTHORIZED) {
            window.location.href = '/login/';
        } else {
            const data = await response.json();
            alert('Something went wrong. ' + data.message);

            // Clear the input fields
            document.querySelector('.js-new-pass-field').value = '';
            document.querySelector('.js-new-pass-confirm-field').value = '';
        }
    } catch (error) {
        // Catch errors during password change
        console.error('Error changing password:', error);
        alert('An error occurred while changing the password.');

        // Clear the input fields
        document.querySelector('.js-new-pass-field').value = '';
        document.querySelector('.js-new-pass-confirm-field').value = '';
    }
}
