import { Link } from 'react-router-dom';
import PolicyPage, { ISSUES_URL, REMOVAL_EMAIL } from '../components/PolicyPage';

export default function Privacy() {
  return (
    <PolicyPage title="Privacy Policy">
      <p>
        Pika is an open-source URL shortener. This policy covers the Pika Chrome extension and this Pika
        server. In short: Pika stores the links you shorten and nothing about who you are. It has no ads
        and no tracking.
      </p>

      <h3>The Chrome extension</h3>
      <ul>
        <li>
          <strong>What it reads:</strong> the address of the current tab, and only when you open the popup
          (to pre-fill it) or pick a Pika item from the right-click menu. It writes to your clipboard when
          you choose a copy action and never reads from it.
        </li>
        <li>
          <strong>Where data goes:</strong> the URLs you shorten are sent only to the Pika server you
          connected the extension to. If you log in to the admin panel, so are your username and password.
          Nothing goes to the extension's developer or anyone else.
        </li>
        <li>
          <strong>What it stores:</strong> only that server's address, in your browser's extension storage.
          Removing the extension deletes it.
        </li>
        <li>
          <strong>No analytics, tracking, or ads.</strong> Its code and fonts are bundled, so it loads
          nothing from third-party sites.
        </li>
        <li>
          If you connect the extension to a Pika server run by someone else, that server's operator handles
          the data you send to it, under their own policies.
        </li>
      </ul>

      <h3>This Pika server</h3>
      <p>
        For each short link it stores the original URL, the short keyword, when the link was created, and
        when it expires. Pika has no user accounts, and links aren't tied to your name, email, or IP
        address.
      </p>
      <p>
        Anyone who has a short link can follow it to the original URL. Don't shorten URLs that contain
        secrets, such as access tokens or private document links.
      </p>

      <h3>Cookies and local storage</h3>
      <ul>
        <li>
          The admin panel sets one session cookie. It is HttpOnly and expires after 30 minutes of
          inactivity. Visitors who don't log in get no cookies.
        </li>
        <li>Your light/dark theme choice is saved in your browser's local storage and stays on your device.</li>
      </ul>

      <h3>Infrastructure and third parties</h3>
      <ul>
        <li>
          Pika runs on Cloudflare Workers and Cloudflare D1. To deliver and protect the service, Cloudflare
          processes request data such as your IP address and browser user agent. Request logs are kept for
          a limited time for troubleshooting. See{' '}
          <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">Cloudflare's privacy policy</a>.
        </li>
        <li>
          This website loads fonts from Google Fonts, so Google receives your IP address when you open it.
          See <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google's privacy policy</a>.
          The Chrome extension doesn't.
        </li>
        <li>Your data isn't sold or shared with anyone else.</li>
      </ul>

      <h3>How long links are kept</h3>
      <p>
        A link stops working when it expires, at the time chosen when it was created (1 hour to 7 days, or
        never). Its stored data is deleted at the next routine cleanup, which runs whenever links are
        created or listed, so it may remain stored for a while after expiry. Links can also be removed
        earlier, as described in the <Link to="/terms-of-use">Terms of Use</Link>. To ask for a link to be removed, email{' '}
        <a href={`mailto:${REMOVAL_EMAIL}?subject=${encodeURIComponent('Pika link removal')}`}>{REMOVAL_EMAIL}</a>{' '}
        with the short link.
      </p>

      <h3>Children</h3>
      <p>Pika isn't directed at children under 13.</p>

      <h3>Changes and contact</h3>
      <p>
        If this policy changes, this page and the date above will be updated. Questions go to{' '}
        <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer">GitHub issues</a>.
      </p>
    </PolicyPage>
  );
}
