import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Terms of Service — Spiros",
  description: "Terms of service for using the Spiros desktop activity tracker.",
};

export default function TermsPage() {
  return (
    <>
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-gold text-lg text-shadow-pixel mb-8">Terms of Service</h1>
        <p className="text-[9px] text-text-dim mb-8">Last updated: February 2026</p>

        <section className="mb-10">
          <h2 className="text-text-bright text-[11px] mb-4">1. Acceptance of Terms</h2>
          <div className="text-[9px] text-text-dim leading-relaxed space-y-3">
            <p>By downloading, installing, or using Spiros (&quot;the App&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the App.</p>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-text-bright text-[11px] mb-4">2. License</h2>
          <div className="text-[9px] text-text-dim leading-relaxed space-y-3">
            <p>Spiros grants you a personal, non-transferable, non-exclusive license to use the App on your devices. You may not:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Reverse engineer, decompile, or disassemble the App</li>
              <li>Redistribute or sublicense the App</li>
              <li>Use the App for any illegal purpose</li>
              <li>Attempt to gain unauthorized access to other users&apos; data</li>
            </ul>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-text-bright text-[11px] mb-4">3. Acceptable Use</h2>
          <div className="text-[9px] text-text-dim leading-relaxed space-y-3">
            <p>You agree to use Spiros only on devices you own or have permission to monitor. You are responsible for ensuring compliance with local laws regarding activity monitoring.</p>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Use the App to monitor others without their knowledge and consent</li>
              <li>Abuse the friend system to harass or stalk other users</li>
              <li>Attempt to extract other users&apos; detailed activity data</li>
              <li>Create multiple accounts to circumvent limitations</li>
            </ul>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-text-bright text-[11px] mb-4">4. Privacy</h2>
          <div className="text-[9px] text-text-dim leading-relaxed space-y-3">
            <p>Your use of Spiros is also governed by our <a href="/privacy" className="text-gold hover:underline">Privacy Policy</a>, which describes how we collect, use, and protect your data.</p>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-text-bright text-[11px] mb-4">5. Disclaimers</h2>
          <div className="text-[9px] text-text-dim leading-relaxed space-y-3">
            <p>Spiros is provided &quot;as is&quot; without warranties of any kind, express or implied. We do not warrant that:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>The App will be error-free or uninterrupted</li>
              <li>Activity tracking will be perfectly accurate</li>
              <li>Data will never be lost (always maintain your own backups)</li>
              <li>The gamification features (XP, levels, resources) have any monetary value</li>
            </ul>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-text-bright text-[11px] mb-4">6. Limitation of Liability</h2>
          <div className="text-[9px] text-text-dim leading-relaxed space-y-3">
            <p>To the maximum extent permitted by law, Spiros and its developers shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of data, profits, or goodwill, arising from your use of or inability to use the App.</p>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-text-bright text-[11px] mb-4">7. Changes to Terms</h2>
          <div className="text-[9px] text-text-dim leading-relaxed space-y-3">
            <p>We may update these terms from time to time. Changes will be posted on this page with an updated revision date. Continued use of the App after changes constitutes acceptance of the new terms.</p>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-text-bright text-[11px] mb-4">8. Contact</h2>
          <div className="text-[9px] text-text-dim leading-relaxed space-y-3">
            <p>For questions about these terms, contact us at: <a href="mailto:legal@spiros.app" className="text-gold hover:underline">legal@spiros.app</a></p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
