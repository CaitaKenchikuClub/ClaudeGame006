import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onReset: () => void;
}

/** 予期しないエラーで画面が真っ白にならないよう、メッセージと「タイトルへ戻る」を表示する */
export default class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="novel-fatal crash-screen">
        <p>エラーが発生しました。</p>
        <p className="error-box">{this.state.error.message}</p>
        <button
          className="btn btn-primary"
          onClick={() => {
            this.setState({ error: null });
            this.props.onReset();
          }}
        >
          タイトルへ戻る
        </button>
      </div>
    );
  }
}
