/**
 * Fetch the api_hostname from /conf.yaml
 * @returns {Promise<string>}
 * @throws If the hostname cannot be parsed, an error is thrown
 */
export async function getApiHostname() {
    const response = await fetch('/conf.yaml');
    const text = await response.text();
    const match = text.match(/api_hostname:\s*"(.*)"/);
    if (!match) {
        throw new Error('API Hostname not found in configuration');
    }
    return match[1];
}

/**
 * Fetch the web_hostname from /conf.yaml
 * @returns {Promise<string>}
 * @throws If the hostname cannot be parsed, an error is thrown
 */
export async function getWebHostname() {
    const response = await fetch('/conf.yaml');
    const text = await response.text();
    const match = text.match(/web_hostname:\s*"(.*)"/);
    if (!match) {
        throw new Error('Web Hostname not found in configuration');
    }
    return match[1];
}
