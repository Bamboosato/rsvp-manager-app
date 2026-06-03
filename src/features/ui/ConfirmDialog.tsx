"use client";

type ConfirmDialogProps = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: "primary" | "danger";
  isProcessing?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = "キャンセル",
  variant = "primary",
  isProcessing = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  return (
    <div className="modal-backdrop">
      <section
        aria-labelledby="confirm-dialog-heading"
        aria-modal="true"
        className="modal-panel confirm-dialog"
        role="dialog"
      >
        <div className="stacked-heading">
          <p className="eyebrow">Confirm</p>
          <h2 id="confirm-dialog-heading">{title}</h2>
        </div>
        <p className="confirm-dialog-message">{message}</p>
        <div className="form-actions">
          <button
            className={variant === "danger" ? "danger-button" : "primary-button"}
            data-tooltip={confirmLabel}
            disabled={isProcessing}
            onClick={onConfirm}
            type="button"
          >
            {isProcessing ? "処理中" : confirmLabel}
          </button>
          <button
            className="secondary-button"
            data-tooltip="操作をキャンセル"
            disabled={isProcessing}
            onClick={onCancel}
            type="button"
          >
            {cancelLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
