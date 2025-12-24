import {getHostname} from '/hostname.js';

(async () => {
    try {
        // Acquire the hostname configuration
        const hostname = await getHostname();

        // Check if the user has admin privileges
        const isAdmin = await checkAdmin(hostname);
        if (!isAdmin) {
            // 如果不是管理員，跳轉至登入頁面
            window.location.href = '/login/';
            return;
        }

        // Render the button and bind the event
        renderButton();

        // Bind the form submission event to change the password
        document.querySelector('form').addEventListener('submit', async function (event) {
            event.preventDefault(); // 防止預設提交行為
            await doChange(hostname);
        });
    } catch (error) {
        // Deal with errors globally, and display error message and log
        console.error('An error occurred:', error);
        alert('Something went wrong, please try again later.');
    }
})();

/**
 * Check if the current user has admin privileges
 * @param {string} hostname - The hostname of the server
 * @returns {Promise<boolean>} Returns whether the user is an admin
 */
async function checkAdmin(hostname) {
    const response = await fetch(`${hostname}/api/v1/admin_check`, {
        method: 'GET',
        credentials: 'include', // Including cookie information
    });
    const data = await response.json();
    return data.status !== false;
}

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
 * @param {string} hostname - The hostname of the server
 */
async function doChange(hostname) {
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
        return;
    }

    try {
        // Send the password change request
        const response = await fetch(`${hostname}/api/v1/change_pass`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({new_pass: password}).toString(), // 將密碼放入請求體
            credentials: 'include',
        });

        const data = await response.json();
        if (data.status) {
            // Successful password change
            alert('Password changed successfully!');
            window.location.href = '/login/';
        } else {
            alert('Failed to change password. Please try again.');
        }
    } catch (error) {
        // Catch errors during password change
        console.error('Error changing password:', error);
        alert('An error occurred while changing the password.');
    }
}
