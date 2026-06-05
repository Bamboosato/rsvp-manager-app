export function RequiredMark() {
  return (
    <sup aria-hidden="true" className="required-mark">
      *
    </sup>
  );
}

export function RequiredNote() {
  return (
    <p className="required-note">
      <RequiredMark />
      は必須項目です。
    </p>
  );
}
