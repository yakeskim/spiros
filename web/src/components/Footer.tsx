export default function Footer() {
  return (
    <footer className="border-t-2 border-border-dark bg-bg-darkest py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Logo */}
          <div className="flex items-center gap-3 text-gold text-sm text-shadow-pixel">
            <span className="text-lg">&#9876;</span>
            <span>SPIROS</span>
          </div>

          {/* Links */}
          <nav className="flex items-center gap-6">
            <a href="#features" className="text-[9px] text-text-dim hover:text-gold transition-colors">
              Features
            </a>
            <a href="/download" className="text-[9px] text-text-dim hover:text-gold transition-colors">
              Download
            </a>
            <a href="#pricing" className="text-[9px] text-text-dim hover:text-gold transition-colors">
              Pricing
            </a>
            <a href="#faq" className="text-[9px] text-text-dim hover:text-gold transition-colors">
              FAQ
            </a>
            <a href="/privacy" className="text-[9px] text-text-dim hover:text-gold transition-colors">
              Privacy
            </a>
            <a href="/terms" className="text-[9px] text-text-dim hover:text-gold transition-colors">
              Terms
            </a>
            <a
              href="https://github.com/yakeskim/spiros"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] text-text-dim hover:text-gold transition-colors"
            >
              GitHub
            </a>
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-6 border-t border-border-dark flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[8px] text-text-dim">
            &copy; 2026 Spiros. All rights reserved.
          </p>
          <p className="text-[8px] text-text-dim">
            Built with &#9876; by adventurers, for adventurers.
          </p>
        </div>
      </div>
    </footer>
  );
}
