interface WarningBannerProps {
  /** One entry per warning; nothing is rendered when empty. */
  messages: string[];
  onClose: () => void;
}

/**
 * Dismissible warning pinned to the bottom-right corner of the viewport.
 */
export const WarningBanner = ({ messages, onClose }: WarningBannerProps) => {
  if (messages.length === 0) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 right-4 z-50 max-w-md flex items-start gap-3 rounded-lg border border-gray-600 bg-black/95 p-4 text-sm text-gray-300 shadow-2xl"
    >
      <span aria-hidden="true" className="text-lg leading-none text-gray-400">
        &#9888;
      </span>
      <div className="flex-1">
        <p className="mb-1 font-semibold text-white">Layout warning</p>
        {messages.map((message) => (
          <p key={message} className="break-words">
            {message}
          </p>
        ))}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss warning"
        className="-mr-1 -mt-1 rounded px-2 text-xl leading-none text-gray-400 hover:bg-gray-800 hover:text-white"
      >
        &times;
      </button>
    </div>
  );
};
