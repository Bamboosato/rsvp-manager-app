"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { ConfirmDialog } from "@/features/ui/ConfirmDialog";
import { AdminAccountMenu } from "./AdminAccountMenu";
import { copyPlainTextToClipboard } from "./clipboard";
import { type AdminLineFriend } from "./lineDelivery";

type LineRegistration = {
  registrationUrl: string | null;
  qrCodeSvg: string;
  missingLineBasicId: boolean;
};

type LineFriendDraft = {
  memo: string;
  isDeliverable: boolean;
};

export function AdminAccountScreen() {
  return (
    <ProtectedRoute>
      <AdminAccountSettings />
    </ProtectedRoute>
  );
}

function AdminAccountSettings() {
  const { signOut, user } = useAuth();
  const [registration, setRegistration] = useState<LineRegistration | null>(null);
  const [friends, setFriends] = useState<AdminLineFriend[]>([]);
  const [drafts, setDrafts] = useState<Record<string, LineFriendDraft>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [savingFriendId, setSavingFriendId] = useState<string | null>(null);
  const [deleteTargetFriend, setDeleteTargetFriend] = useState<AdminLineFriend | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [copyFeedback, setCopyFeedback] = useState("");

  const loadAccount = useCallback(async () => {
    if (!user) {
      return;
    }

    setError("");

    try {
      const idToken = await user.getIdToken();
      const [registrationResponse, friendsResponse] = await Promise.all([
        fetch("/api/admin/line/registration", {
          headers: {
            Authorization: `Bearer ${idToken}`
          }
        }),
        fetch("/api/admin/line/friends", {
          headers: {
            Authorization: `Bearer ${idToken}`
          }
        })
      ]);
      const registrationResult = (await registrationResponse.json().catch(() => null)) as
        | (LineRegistration & { message?: string })
        | null;
      const friendsResult = (await friendsResponse.json().catch(() => null)) as
        | { friends?: AdminLineFriend[]; message?: string }
        | null;

      if (!registrationResponse.ok || !registrationResult) {
        setError(registrationResult?.message ?? "LINE連携情報の取得に失敗しました。");
        return;
      }

      if (!friendsResponse.ok || !friendsResult) {
        setError(friendsResult?.message ?? "LINE友だち一覧の取得に失敗しました。");
        return;
      }

      const nextFriends = friendsResult.friends ?? [];

      setRegistration(registrationResult);
      setFriends(nextFriends);
      setDrafts(
        nextFriends.reduce<Record<string, LineFriendDraft>>((nextDrafts, friend) => {
          nextDrafts[friend.id] = {
            memo: friend.memo,
            isDeliverable: friend.isDeliverable
          };
          return nextDrafts;
        }, {})
      );
    } catch {
      setError("通信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadAccount();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadAccount]);

  async function handleCopyRegistrationUrl() {
    if (!registration?.registrationUrl) {
      return;
    }

    try {
      await copyPlainTextToClipboard(registration.registrationUrl);
      showCopyFeedback("URLをコピーしました");
    } catch {
      setError("コピーに失敗しました。ブラウザの設定を確認してください。");
    }
  }

  function showCopyFeedback(message: string) {
    setCopyFeedback(message);
    window.setTimeout(() => {
      setCopyFeedback("");
    }, 3000);
  }

  function updateDraft(friendId: string, draft: Partial<LineFriendDraft>) {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [friendId]: {
        memo: currentDrafts[friendId]?.memo ?? "",
        isDeliverable: currentDrafts[friendId]?.isDeliverable ?? true,
        ...draft
      }
    }));
  }

  async function handleSaveFriend(friend: AdminLineFriend) {
    if (!user) {
      return;
    }

    const draft = drafts[friend.id];

    if (!draft) {
      return;
    }

    setSavingFriendId(friend.id);
    setError("");
    setNotice("");

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/admin/line/friends/${friend.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(draft)
      });
      const result = (await response.json().catch(() => null)) as
        | { friend?: AdminLineFriend; message?: string }
        | null;

      if (!response.ok || !result?.friend) {
        setError(result?.message ?? "LINE友だちの更新に失敗しました。");
        return;
      }

      setFriends((currentFriends) =>
        currentFriends.map((currentFriend) =>
          currentFriend.id === friend.id ? result.friend! : currentFriend
        )
      );
      setNotice("LINE友だちを更新しました。");
    } catch {
      setError("LINE友だちの更新に失敗しました。");
    } finally {
      setSavingFriendId(null);
    }
  }

  async function handleDeleteFriend() {
    if (!user || !deleteTargetFriend) {
      return;
    }

    setSavingFriendId(deleteTargetFriend.id);
    setError("");
    setNotice("");

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/admin/line/friends/${deleteTargetFriend.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${idToken}`
        }
      });
      const result = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        setError(result?.message ?? "LINE友だちの削除に失敗しました。");
        setDeleteTargetFriend(null);
        return;
      }

      setFriends((currentFriends) =>
        currentFriends.filter((friend) => friend.id !== deleteTargetFriend.id)
      );
      setDeleteTargetFriend(null);
      setNotice("LINE友だちを削除しました。");
    } catch {
      setError("LINE友だちの削除に失敗しました。");
      setDeleteTargetFriend(null);
    } finally {
      setSavingFriendId(null);
    }
  }

  if (isLoading) {
    return (
      <main className="app-shell admin-account-shell">
        <section className="loading-panel" role="status" aria-live="polite">
          読み込み中...
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell admin-account-shell">
      <header className="top-bar sticky-top-bar">
        <div className="page-heading">
          <div className="title-row">
            <Link className="back-link" data-tooltip="マイプランへ戻る" href="/admin/plans">
              <span>←</span>
              <span>戻る</span>
            </Link>
            <div className="title-stack">
              <span className="title-label">Account</span>
              <h1>アカウント設定</h1>
            </div>
          </div>
        </div>
        <AdminAccountMenu user={user} onSignOut={signOut} />
      </header>

      {notice ? <p className="success-message top-message">{notice}</p> : null}
      {error ? <p className="error-message top-message">{error}</p> : null}

      <div className="admin-account-grid">
        <section className="panel line-account-panel" aria-label="LINE連携">
          <div className="section-heading">
            <div>
              <p className="eyebrow">LINE</p>
              <h2>LINE連携</h2>
            </div>
          </div>

          {registration ? (
            <div className="line-registration-grid">
              <div className="line-registration-main">
                {registration.missingLineBasicId ? (
                  <p className="notice-message top-message">
                    LINE公式アカウントのBasic IDが未設定です。LINE登録用URLとQRコードを表示するには
                    `LINE_BASIC_ID` を設定してください。
                  </p>
                ) : (
                  <p className="muted-text top-message">
                    URLまたはQRコードを共有して、LINE友だち登録を案内できます。
                  </p>
                )}
              </div>
              <div className="line-registration-actions">
                {registration.registrationUrl ? (
                  <span className="copy-feedback-wrap">
                    <button
                      className="secondary-button"
                      data-tooltip="LINE登録用URLをコピー"
                      onClick={handleCopyRegistrationUrl}
                      type="button"
                    >
                      URLコピー
                    </button>
                    {copyFeedback ? (
                      <span className="copy-feedback" role="status">
                        {copyFeedback}
                      </span>
                    ) : null}
                  </span>
                ) : null}
                {registration.qrCodeSvg ? (
                  <div className="line-qr-card" aria-label="LINE友だち登録用QRコード">
                    <div
                      className="line-qr-code"
                      dangerouslySetInnerHTML={{ __html: registration.qrCodeSvg }}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="notice-message top-message">LINE連携情報を表示できません。</p>
          )}
        </section>

        <section className="panel line-friends-panel" aria-label="LINE友だち一覧">
          <div className="section-heading">
            <div>
              <p className="eyebrow">LINE Friends</p>
              <h2>LINE友だち一覧</h2>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>友だち</th>
                  <th>メモ</th>
                  <th>配信対象</th>
                  <th>状態</th>
                  <th className="action-column two-actions">操作</th>
                </tr>
              </thead>
              <tbody>
                {friends.length === 0 ? (
                  <tr>
                    <td className="table-empty-cell" colSpan={5}>
                      登録されたLINE友だちはありません。LINE登録用URLまたはQRコードを共有してください。
                    </td>
                  </tr>
                ) : (
                  friends.map((friend) => {
                    const draft = drafts[friend.id] ?? {
                      memo: friend.memo,
                      isDeliverable: friend.isDeliverable
                    };
                    const isSaving = savingFriendId === friend.id;

                    return (
                      <tr key={friend.id}>
                        <td className="line-friend-name-cell">
                          <LineFriendAvatar friend={friend} />
                          <span>
                            <strong>{friend.displayName}</strong>
                            <small>{formatDateTime(friend.registeredAt)}</small>
                          </span>
                        </td>
                        <td>
                          <input
                            className="table-input"
                            disabled={isSaving}
                            maxLength={120}
                            onChange={(event) =>
                              updateDraft(friend.id, { memo: event.target.value })
                            }
                            placeholder="本名など"
                            type="text"
                            value={draft.memo}
                          />
                        </td>
                        <td>
                          <label className="checkbox-field">
                            <input
                              checked={draft.isDeliverable}
                              disabled={isSaving || !friend.isFriend}
                              onChange={(event) =>
                                updateDraft(friend.id, {
                                  isDeliverable: event.target.checked
                                })
                              }
                              type="checkbox"
                            />
                            <span>配信対象</span>
                          </label>
                        </td>
                        <td>
                          <span className={friend.isFriend ? "status-badge" : "status-badge muted"}>
                            {friend.isFriend ? "友だち" : "ブロック"}
                          </span>
                        </td>
                        <td className="action-column two-actions">
                          <div className="row-actions">
                            <button
                              className="secondary-button compact-button"
                              data-tooltip="LINE友だちのメモと配信対象を保存"
                              disabled={isSaving}
                              onClick={() => handleSaveFriend(friend)}
                              type="button"
                            >
                              {isSaving ? "保存中" : "保存"}
                            </button>
                            <button
                              className="danger-button compact-button"
                              data-tooltip="LINE友だち一覧から削除"
                              disabled={isSaving}
                              onClick={() => setDeleteTargetFriend(friend)}
                              type="button"
                            >
                              削除
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {deleteTargetFriend ? (
        <ConfirmDialog
          confirmLabel="削除する"
          isProcessing={savingFriendId === deleteTargetFriend.id}
          message={`「${deleteTargetFriend.displayName}」をLINE友だち一覧から削除します。以後、この管理画面からは配信対象に選択できません。`}
          onCancel={() => setDeleteTargetFriend(null)}
          onConfirm={handleDeleteFriend}
          title="LINE友だち削除の確認"
          variant="danger"
        />
      ) : null}
    </main>
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

function formatDateTime(value: string | null) {
  if (!value) {
    return "登録日時なし";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
