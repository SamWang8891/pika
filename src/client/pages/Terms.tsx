import { Link } from 'react-router-dom';
import PolicyPage, { ISSUES_URL } from '../components/PolicyPage';

export default function Terms() {
  return (
    <PolicyPage title="Terms of Use">
      <p>
        By using this Pika server or the Pika Chrome extension, you agree to these terms. How data is
        handled is covered in the <Link to="/privacy-policy">Privacy Policy</Link>.
      </p>

      <h3>Provided as is</h3>
      <p>
        Pika is a free, open-source hobby project. It comes "as is", with no warranty of any kind, no
        uptime guarantee, and no promise of support.
      </p>

      <h3>Your links are not guaranteed to last</h3>
      <ul>
        <li>
          A link stops working at the expiry time you chose. Its keyword is then freed and may later point
          to a different URL.
        </li>
        <li>
          Any link, including one set to never expire, may be removed, reset, or lost at any time without
          notice: for example during maintenance, a database reset, or abuse cleanup.
        </li>
        <li>
          <strong>Don't rely on this server for links that must keep working</strong>, such as printed
          material, long-term documents, or anything critical.
        </li>
      </ul>

      <h3>Want full control? Host your own</h3>
      <p>
        Self-hosting is encouraged. Pika is open source and runs on Cloudflare's free tier, so you can
        run your own server, on your own domain, with your links and data under your control. The{' '}
        <a href="https://github.com/SamWang8891/pika#deploying-" target="_blank" rel="noopener noreferrer">deploy guide</a>{' '}
        takes a few minutes, and the Pika Chrome extension works with any Pika server.
      </p>

      <h3>Acceptable use</h3>
      <p>Don't use Pika to create links to, or for:</p>
      <ul>
        <li>malware, phishing, scams, or other deceptive or harmful content;</li>
        <li>illegal content, or content that infringes other people's rights;</li>
        <li>spam, or high-volume automated requests that degrade the service for others;</li>
        <li>hiding where a link leads in order to mislead people.</li>
      </ul>
      <p>The operator may delete any link or block access at any time, without notice.</p>

      <h3>Rate limits</h3>
      <p>
        Requests may be rate-limited, including link creation and admin login, to keep the service
        available. Don't try to get around rate limits or other protections.
      </p>

      <h3>Admin access</h3>
      <p>The admin panel is for this server's operator only. Don't try to access it without permission.</p>

      <h3>Limitation of liability</h3>
      <p>
        To the extent the law allows, the operator isn't liable for any loss or damage from using Pika.
        That includes links that are lost, removed, or broken, and keywords reissued to other URLs after
        they expire.
      </p>

      <h3>Open source</h3>
      <p>
        Pika's source code is available under the{' '}
        <a href="https://github.com/SamWang8891/pika/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">Apache License 2.0</a>.
        These terms cover using this server and the published Chrome extension; the license covers the code.
      </p>

      <h3>Changes and contact</h3>
      <p>
        These terms may change, and the date above shows the current version. Using Pika after a change
        means you accept the new terms. Questions go to{' '}
        <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer">GitHub issues</a>.
      </p>
    </PolicyPage>
  );
}
