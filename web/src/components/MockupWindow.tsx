interface MockupWindowProps {
  children: React.ReactNode;
  sidebar?: boolean;
  activeNav?: number;
}

const NAV_ICONS = ["\u25C8", "\u2B21", "\u2605", "\u2654", "\u2665", "\u2699"];

export default function MockupWindow({
  children,
  sidebar = false,
  activeNav = 0,
}: MockupWindowProps) {
  return (
    <div className="border-2 border-border-light bg-bg-darkest shadow-pixel w-full max-w-lg mx-auto">
      {/* Title bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-bg-panel border-b-2 border-border-dark">
        <div className="flex items-center gap-2">
          <span className="text-gold text-sm">&#9876;</span>
          <span className="text-[10px] text-text-dim">SPIROS</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-dim cursor-default">&#9472;</span>
          <span className="text-[10px] text-text-dim cursor-default">&#9633;</span>
          <span className="text-[10px] text-red cursor-default">&#10005;</span>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        {sidebar && (
          <div className="flex flex-col items-center gap-1 py-3 px-2 border-r-2 border-border-dark bg-bg-dark/50 min-w-[36px]">
            {NAV_ICONS.map((icon, i) => (
              <div
                key={i}
                className={`w-7 h-7 flex items-center justify-center text-[12px] ${
                  i === activeNav
                    ? "text-gold bg-gold/10 border border-gold/30"
                    : "text-text-dim hover:text-text-bright"
                }`}
              >
                {icon}
              </div>
            ))}
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 p-5 min-h-[280px]">{children}</div>
      </div>
    </div>
  );
}
