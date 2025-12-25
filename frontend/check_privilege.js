import {getApiHostname} from "./hostname.js";
import {HTTP} from './response.js'

const apiHostname = await getApiHostname();

/**
 * Check if the current user is an admin
 * @returns {Promise<boolean>}
 */
export async function checkAdmin() {
    const response = await fetch(`${apiHostname}/api/v2/admin_check`, {
        method: 'GET',
        credentials: 'include', // Including cookie information
    });
    const data = await response.json();

    return data.status === HTTP.OK;
}