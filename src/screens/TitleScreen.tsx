interface Props {
  onStart: () => void;
}

export default function TitleScreen({ onStart }: Props) {
  return (
    <div className="title-screen">
      <div className="title-logo">
        <p className="title-sub">Web小説 試し読みノベル</p>
        <h1 className="title-main">ノベルコラボ</h1>
      </div>
      <button className="btn btn-primary" onClick={onStart}>
        スタート
      </button>
      <p className="title-footer">タップで物語を読み進めよう</p>
    </div>
  );
}
