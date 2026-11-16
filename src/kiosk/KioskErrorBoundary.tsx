import { Component, type ErrorInfo, type ReactNode } from 'react';

export const CRASH_RELOAD_MS = 30_000;

interface Props {
  children: ReactNode;
  /** Перезагрузка страницы — граница браузера (подменяется в тестах). */
  reload?: () => void;
}

/** Любой сбой рендера: вместо белого экрана — сообщение и автоперезагрузка через 30 с. */
export class KioskErrorBoundary extends Component<Props, { crashed: boolean }> {
  state = { crashed: false };
  private timer?: ReturnType<typeof setTimeout>;

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
    clearTimeout(this.timer);
    this.timer = setTimeout(this.props.reload ?? (() => window.location.reload()), CRASH_RELOAD_MS);
  }

  componentWillUnmount() {
    clearTimeout(this.timer);
  }

  render() {
    if (!this.state.crashed) return this.props.children;
    return (
      <div className="fullscreen-message" role="alert">
        <h1>Информация временно недоступна</h1>
        <p>Пожалуйста, обратитесь к администратору на стойке регистрации.</p>
      </div>
    );
  }
}
