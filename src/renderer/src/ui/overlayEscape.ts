// Radix overlays take Esc in the capture phase, before the focused control
// sees it. Pass this as their onEscapeKeyDown, so Esc that reverts an invalid
// field or cancels a drag does only that and keeps the overlay open.
export function keepOpenOnLocalEscape(event: KeyboardEvent): void {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const invalidField = target.getAttribute('aria-invalid') === 'true';
  // dnd-kit marks a drag handle pressed while it drags.
  const dragging =
    target.getAttribute('aria-roledescription') === 'sortable' &&
    target.getAttribute('aria-pressed') === 'true';
  if (invalidField || dragging) event.preventDefault();
}
