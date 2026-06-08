"use client";

import {
  formatEventDate,
  formatEventTime,
  type AdminEvent
} from "./events/data";

export function InviteShareDialog({
  events,
  selectedEventIds,
  error,
  isProcessing,
  onToggleEvent,
  onCopy,
  onCancel
}: {
  events: AdminEvent[];
  selectedEventIds: string[];
  error: string;
  isProcessing: boolean;
  onToggleEvent: (eventId: string, checked: boolean) => void;
  onCopy: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const selectedEventIdSet = new Set(selectedEventIds);
  const selectedCount = events.filter((event) => selectedEventIdSet.has(event.id)).length;

  return (
    <div className="modal-backdrop">
      <section
        aria-labelledby="invite-share-dialog-heading"
        aria-modal="true"
        className="modal-panel invite-share-dialog"
        role="dialog"
      >
        <div className="stacked-heading">
          <p className="eyebrow">Share URL</p>
          <h2 id="invite-share-dialog-heading">配信用URL</h2>
          <p className="invite-share-dialog-description">
            配信に含めるイベントを選択してください。
          </p>
        </div>

        {events.length === 0 ? (
          <p className="notice-message top-message">受付中のイベントがありません。</p>
        ) : (
          <div className="invite-share-event-list" aria-label="配信用URLに含めるイベント">
            {events.map((event) => (
              <label className="invite-share-event-row" key={event.id}>
                <input
                  checked={selectedEventIdSet.has(event.id)}
                  disabled={isProcessing}
                  onChange={(changeEvent) =>
                    onToggleEvent(event.id, changeEvent.target.checked)
                  }
                  type="checkbox"
                />
                <span className="invite-share-event-main">
                  <span className="invite-share-event-date">
                    {formatEventDate(event.eventDate)}
                  </span>
                  <span className="invite-share-event-time">
                    {formatEventTime(event.timeSlot, event.timeDetail)}
                  </span>
                  <span className="invite-share-event-name">
                    {getEventTitle(event)} / {event.place}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}

        {error ? <p className="error-message top-message">{error}</p> : null}

        <div className="form-actions">
          <button
            className="primary-button"
            data-tooltip="選択したイベントの配信用URLをコピー"
            disabled={isProcessing || selectedCount === 0}
            onClick={onCopy}
            type="button"
          >
            {isProcessing ? "作成中" : "URLコピー"}
          </button>
          <button
            className="secondary-button"
            data-tooltip="配信用URL作成をキャンセル"
            disabled={isProcessing}
            onClick={onCancel}
            type="button"
          >
            キャンセル
          </button>
        </div>
      </section>
    </div>
  );
}

function getEventTitle(event: AdminEvent) {
  return event.name || "イベント名未設定";
}
