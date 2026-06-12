"use client";

import { useState } from "react";
import {
  formatEventDate,
  formatEventTime,
  type AdminEvent
} from "./events/data";
import type { AdminLineFriend } from "./lineDelivery";

type LineDeliveryStep = "events" | "friends" | "greeting";

const lineDeliverySteps: { id: LineDeliveryStep; label: string }[] = [
  { id: "events", label: "配信イベント" },
  { id: "friends", label: "配信先" },
  { id: "greeting", label: "挨拶文" }
];

export function LineInviteDeliveryDialog({
  events,
  friends,
  selectedEventIds,
  selectedFriendIds,
  greeting,
  error,
  isProcessing,
  onToggleEvent,
  onToggleFriend,
  onGreetingChange,
  onSend,
  onCancel
}: {
  events: AdminEvent[];
  friends: AdminLineFriend[];
  selectedEventIds: string[];
  selectedFriendIds: string[];
  greeting: string;
  error: string;
  isProcessing: boolean;
  onToggleEvent: (eventId: string, checked: boolean) => void;
  onToggleFriend: (friendId: string, checked: boolean) => void;
  onGreetingChange: (greeting: string) => void;
  onSend: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const [currentStep, setCurrentStep] = useState<LineDeliveryStep>("events");
  const selectedEventIdSet = new Set(selectedEventIds);
  const selectedFriendIdSet = new Set(selectedFriendIds);
  const selectedEventCount = events.filter((event) => selectedEventIdSet.has(event.id)).length;
  const deliverableFriends = friends.filter((friend) => friend.isDeliverable && friend.isFriend);
  const selectedFriendCount = deliverableFriends.filter((friend) =>
    selectedFriendIdSet.has(friend.id)
  ).length;
  const currentStepIndex = lineDeliverySteps.findIndex((step) => step.id === currentStep);
  const isEventStep = currentStep === "events";
  const isFriendStep = currentStep === "friends";
  const isGreetingStep = currentStep === "greeting";

  function goToNextStep() {
    if (currentStep === "events") {
      setCurrentStep("friends");
      return;
    }

    if (currentStep === "friends") {
      setCurrentStep("greeting");
    }
  }

  function goToPreviousStep() {
    if (currentStep === "greeting") {
      setCurrentStep("friends");
      return;
    }

    if (currentStep === "friends") {
      setCurrentStep("events");
    }
  }

  return (
    <div className="modal-backdrop">
      <section
        aria-labelledby="line-delivery-dialog-heading"
        aria-modal="true"
        className="modal-panel line-delivery-dialog"
        role="dialog"
      >
        <button
          aria-label="LINE配信を閉じる"
          className="account-close-button line-delivery-close-button"
          data-tooltip="LINE配信を閉じる"
          disabled={isProcessing}
          onClick={onCancel}
          type="button"
        >
          ×
        </button>
        <div className="stacked-heading line-delivery-heading">
          <p className="eyebrow">LINE Delivery</p>
          <h2 id="line-delivery-dialog-heading">LINE配信</h2>
        </div>

        <ol className="line-delivery-steps" aria-label="LINE配信ステップ">
          {lineDeliverySteps.map((step, index) => (
            <li
              className={[
                "line-delivery-step",
                index === currentStepIndex ? "active" : "",
                index < currentStepIndex ? "completed" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              key={step.id}
            >
              <span>{index + 1}</span>
              <strong>{step.label}</strong>
            </li>
          ))}
        </ol>

        <div className="line-delivery-step-panel">
          {isEventStep ? (
            <section className="line-delivery-section" aria-label="配信イベント">
              <h3>配信イベント</h3>
              {events.length === 0 ? (
                <p className="notice-message">受付中のイベントがありません。</p>
              ) : (
                <div className="invite-share-event-list">
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
            </section>
          ) : null}

          {isFriendStep ? (
            <section className="line-delivery-section" aria-label="LINE配信先選択">
              <h3>LINE配信先選択</h3>
              <div className="line-friend-select-table">
                <div className="line-friend-select-header" role="row">
                  <span>友だち</span>
                  <span>メモ</span>
                  <span>選択</span>
                </div>
                {deliverableFriends.length === 0 ? (
                  <p className="line-friend-select-empty">
                    配信可能なLINE友だちはありません。アカウント設定でLINE友だちを確認してください。
                  </p>
                ) : (
                  <div className="line-friend-select-list">
                    {deliverableFriends.map((friend) => (
                      <label className="line-friend-select-row" key={friend.id}>
                        <span className="line-friend-select-main">
                          <LineFriendAvatar friend={friend} />
                          <strong>{friend.displayName}</strong>
                        </span>
                        <span className="line-friend-select-memo">
                          {friend.memo || "メモ未設定"}
                        </span>
                        <input
                          checked={selectedFriendIdSet.has(friend.id)}
                          disabled={isProcessing}
                          onChange={(changeEvent) =>
                            onToggleFriend(friend.id, changeEvent.target.checked)
                          }
                          type="checkbox"
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ) : null}

          {isGreetingStep ? (
            <label className="field">
              <span>挨拶文（任意）</span>
              <textarea
                disabled={isProcessing}
                maxLength={500}
                onChange={(event) => onGreetingChange(event.target.value)}
                placeholder="例）出欠確認のお願いです。ご都合をお知らせください。"
                rows={4}
                value={greeting}
              />
            </label>
          ) : null}
        </div>

        {error ? <p className="error-message top-message">{error}</p> : null}

        <div className="form-actions line-delivery-actions">
          {isFriendStep || isGreetingStep ? (
            <button
              className="secondary-button"
              data-tooltip="前の画面へ戻る"
              disabled={isProcessing}
              onClick={goToPreviousStep}
              type="button"
            >
              戻る
            </button>
          ) : null}
          {isEventStep || isFriendStep ? (
            <button
              className="primary-button"
              data-tooltip="次の画面へ進む"
              disabled={
                isProcessing ||
                (isEventStep && selectedEventCount === 0) ||
                (isFriendStep && selectedFriendCount === 0)
              }
              onClick={goToNextStep}
              type="button"
            >
              次へ
            </button>
          ) : null}
          {isGreetingStep ? (
            <button
              className="primary-button"
              data-tooltip="選択したLINE友だちへ配信用URLを送信"
              disabled={isProcessing || selectedEventCount === 0 || selectedFriendCount === 0}
              onClick={onSend}
              type="button"
            >
              {isProcessing ? "配信中" : "配信"}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function LineFriendAvatar({ friend }: { friend: AdminLineFriend }) {
  if (friend.pictureUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt=""
        className="line-friend-avatar"
        height={40}
        referrerPolicy="no-referrer"
        src={friend.pictureUrl}
        width={40}
      />
    );
  }

  return (
    <span className="line-friend-avatar fallback" aria-hidden="true">
      {friend.displayName.slice(0, 1) || "L"}
    </span>
  );
}

function getEventTitle(event: AdminEvent) {
  return event.name || "イベント名未設定";
}
