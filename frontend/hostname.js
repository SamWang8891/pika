/**
 * Fetch the hostname from /conf.yaml
 * @returns {Promise<string>}
 * @throws If the hostname cannot be parsed, an error is thrown
 */
export async function getHostname() {
    const response = await fetch('/conf.yaml');
    const text = await response.text();
    const match = text.match(/hostname:\s*"(.*)"/);
    if (!match) {
        throw new Error('Hostname not found in configuration');
    }
    return match[1];
}