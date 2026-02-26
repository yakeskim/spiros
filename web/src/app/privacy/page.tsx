import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Privacy Policy — Spiros",
  description: "How Spiros collects, stores, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-gold text-lg text-shadow-pixel mb-8">Privacy Policy</h1>
        <p className="text-[9px] text-text-dim mb-8">Last updated: February 2026</p>

        <section className="mb-10">
          <h2 className="text-text-bright text-[11px] mb-4">1. What We Collect</h2>
          <div className="text-[9px] text-text-dim leading-relaxed space-y-3">
            <p>Spiros tracks desktop activity to power its features. By default, we collect:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Active application names and usage duration</li>
              <li>Click and scroll counts (not content)</li>
              <li>Keystroke counts (not what you type)</li>
              <li>Activity categorization (coding, browsing, gaming, etc.)</li>
            </ul>
            <p>The following are <strong className="text-text-bright">opt-in only</strong> and disabled by default:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Window titles (document names, web page titles)</li>
              <li>Browser domain extraction</li>
              <li>Cloud sync of keystroke statistics</li>
              <li>Cloud sync of detailed activity entries</li>
              <li>Detailed stat sharing with friends</li>
            </ul>
            <p>We never collect passwords, file contents, keylogged text, screenshots, or clipboard data.</p>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-text-bright text-[11px] mb-4">2. How Data Is Stored</h2>
          <div className="text-[9px] text-text-dim leading-relaxed space-y-3">
            <p><strong className="text-text-bright">Locally:</strong> Activity data is stored as JSON files in your system&apos;s app data folder. Session tokens are encrypted using your operating system&apos;s secure storage (Windows DPAPI / macOS Keychain).</p>
            <p><strong className="text-text-bright">Cloud (optional):</strong> If you create an account and enable cloud sync, activity summaries are stored in a Supabase-hosted PostgreSQL database. Data in transit is encrypted via TLS. Data at rest is encrypted by the hosting provider.</p>
            <p>You can configure a data retention period (30 to 365 days, or keep forever) in Settings. Expired data is automatically deleted on app startup.</p>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-text-bright text-[11px] mb-4">3. Privacy Controls</h2>
          <div className="text-[9px] text-text-dim leading-relaxed space-y-3">
            <p>Spiros gives you granular control over your data in Settings &gt; Privacy:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Toggle window title tracking on/off</li>
              <li>Toggle keystroke count tracking on/off</li>
              <li>Toggle browser domain tracking on/off</li>
              <li>Control what gets synced to the cloud</li>
              <li>Control what friends can see</li>
              <li>Set automatic data retention periods</li>
            </ul>
            <p>All privacy-sensitive features default to <strong className="text-text-bright">off</strong>. You opt in to more data sharing, never out.</p>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-text-bright text-[11px] mb-4">4. Friends & Sharing</h2>
          <div className="text-[9px] text-text-dim leading-relaxed space-y-3">
            <p>When you compare stats with friends, they only see:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Total active time</li>
              <li>Time per category (coding, gaming, etc.)</li>
              <li>Active days count</li>
            </ul>
            <p>Friends cannot see your app names, window titles, keystroke counts, or browsing domains. This data is stripped server-side before it reaches their device.</p>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-text-bright text-[11px] mb-4">5. Data Export & Deletion</h2>
          <div className="text-[9px] text-text-dim leading-relaxed space-y-3">
            <p>You can export all your data as JSON at any time via Settings &gt; Data Management &gt; Export.</p>
            <p>You can delete all local activity history via Settings &gt; Clear History.</p>
            <p>You can permanently delete your account and all associated cloud data via Settings &gt; Account &gt; Delete Account. This removes all activity records, friend connections, and profile data from our servers.</p>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-text-bright text-[11px] mb-4">6. Software Updates</h2>
          <div className="text-[9px] text-text-dim leading-relaxed space-y-3">
            <p>By default, Spiros automatically checks for and downloads updates from GitHub Releases. This involves a periodic HTTPS request to <strong className="text-text-bright">github.com</strong> to check for new versions. No personal data is sent during this process.</p>
            <p>When an update is downloaded, it is installed automatically the next time you close the app. You can disable automatic updates at any time in Settings &gt; Updates &gt; Auto-download updates. Manual update checks remain available even when auto-update is off.</p>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-text-bright text-[11px] mb-4">7. Third Parties</h2>
          <div className="text-[9px] text-text-dim leading-relaxed space-y-3">
            <p>We use the following third-party services:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong className="text-text-bright">Supabase</strong> — database hosting and authentication (PostgreSQL, hosted in AWS us-east-1)</li>
              <li><strong className="text-text-bright">GitHub</strong> — source code hosting and release distribution for app updates</li>
              <li><strong className="text-text-bright">Vercel</strong> — website hosting for this marketing site</li>
            </ul>
            <p>We do not sell, rent, or share your data with advertisers, data brokers, or any other third parties. We do not use analytics or tracking pixels on the desktop app.</p>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-text-bright text-[11px] mb-4">8. Contact</h2>
          <div className="text-[9px] text-text-dim leading-relaxed space-y-3">
            <p>For privacy questions or data requests, contact us at: <a href="mailto:privacy@spiros.app" className="text-gold hover:underline">privacy@spiros.app</a></p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
