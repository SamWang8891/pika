import {getHostname} from '/hostname.js';

(async () => {
    try {
        // Get the hostname of the server
        const hostname = await getHostname();

        // Bind the click event of all .js-submit-button
        document.querySelectorAll('.js-submit-button').forEach((button) => {
            button.addEventListener('click', (event) => {
                event.preventDefault(); // Prevent the default action of button
                doLogin(); // Execute the login
            });
        });

        // Bind the form submission event
        document.querySelector('form').addEventListener('submit', function (event) {
            event.preventDefault(); // Prevent the default action of submitting form
            doLogin(); // Execute the login
        });

        /**
         * Deal with login logic
         */
        function doLogin() {
            // Get the username and password from the input fields
            const username = document.querySelector('.js-username-field').value.trim();
            const password = document.querySelector('.js-password-field').value;

            // Verify that the input is valid
            if (!username || !password) {
                alert('Please enter both username and password');
                return;
            }

            // Send the login request
            fetch(`${hostname}/api/v1/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({username, password}), // Serialize the username and password
                credentials: 'include', // Include the cookie information
            })
                .then((response) => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                })
                .then((data) => {
                    if (data.status === true) {
                        // Login successful, redirect to the admin page
                        window.location.href = '/admin/';
                    } else {
                        // Login failed, display error message
                        alert('Invalid username or password');
                    }
                })
                .catch((error) => {
                    // Handle network or other exceptions
                    console.error('Login error:', error);
                    alert('An error occurred while trying to log in. Please try again later.');
                });
        }
    } catch (error) {
        // Catch global errors (such as hostname cannot be obtained)
        console.error('Error occurred during initialization:', error);
        alert('Failed to initialize the application. Please try again later.');
    }
})();
