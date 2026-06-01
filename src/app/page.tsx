const samplePlans = [
  {
    name: "2026年06月 練習会",
    month: "2026年06月",
    status: "有効",
    events: 4,
    yes: 18,
    maybe: 6,
    no: 3
  },
  {
    name: "2026年07月 交流会",
    month: "2026年07月",
    status: "有効",
    events: 2,
    yes: 11,
    maybe: 4,
    no: 2
  }
];

const sampleEvents = [
  {
    date: "2026/06/06",
    slot: "AM",
    name: "定例練習",
    place: "中央コート",
    status: "受付中",
    yes: 10,
    maybe: 3,
    no: 1
  },
  {
    date: "2026/06/13",
    slot: "PM",
    name: "ゲーム練習",
    place: "東コート",
    status: "締切済",
    yes: 8,
    maybe: 3,
    no: 2
  }
];

export default function Home() {
  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">RSVP Manager</p>
          <h1>出欠管理ダッシュボード</h1>
        </div>
        <button className="secondary-button" type="button">
          通知を有効にする
        </button>
      </header>

      <section className="summary-grid" aria-label="出欠サマリー">
        <SummaryCard label="参加" value={29} tone="yes" />
        <SummaryCard label="未定" value={10} tone="maybe" />
        <SummaryCard label="不参加" value={5} tone="no" />
      </section>

      <section className="workspace-grid">
        <section className="panel" aria-labelledby="plans-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Plans</p>
              <h2 id="plans-heading">プラン一覧</h2>
            </div>
            <button className="primary-button" type="button">
              プラン追加
            </button>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>プラン名</th>
                  <th>年月</th>
                  <th>状態</th>
                  <th>イベント</th>
                  <th>出欠</th>
                </tr>
              </thead>
              <tbody>
                {samplePlans.map((plan) => (
                  <tr key={plan.name}>
                    <td className="strong-cell">{plan.name}</td>
                    <td>{plan.month}</td>
                    <td>
                      <span className="status-badge">{plan.status}</span>
                    </td>
                    <td>{plan.events}</td>
                    <td>
                      <AttendanceBadges
                        yes={plan.yes}
                        maybe={plan.maybe}
                        no={plan.no}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel" aria-labelledby="events-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Events</p>
              <h2 id="events-heading">イベント一覧</h2>
            </div>
            <button className="secondary-button" type="button">
              URLコピー
            </button>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>日程</th>
                  <th>時間帯</th>
                  <th>イベント</th>
                  <th>場所</th>
                  <th>状態</th>
                  <th>出欠</th>
                </tr>
              </thead>
              <tbody>
                {sampleEvents.map((event) => (
                  <tr key={`${event.date}-${event.slot}`}>
                    <td>{event.date}</td>
                    <td>{event.slot}</td>
                    <td className="strong-cell">{event.name}</td>
                    <td>{event.place}</td>
                    <td>
                      <span
                        className={
                          event.status === "受付中"
                            ? "status-badge"
                            : "status-badge muted"
                        }
                      >
                        {event.status}
                      </span>
                    </td>
                    <td>
                      <AttendanceBadges
                        yes={event.yes}
                        maybe={event.maybe}
                        no={event.no}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section className="guest-preview" aria-labelledby="guest-heading">
        <div>
          <p className="eyebrow">Guest View</p>
          <h2 id="guest-heading">招待者入力UIの基準</h2>
        </div>
        <div className="guest-card">
          <div>
            <p className="event-date">2026/06/06 AM</p>
            <h3>定例練習</h3>
            <p className="muted-text">中央コート</p>
          </div>
          <div className="choice-row" aria-label="出欠選択">
            <button className="choice-button selected" type="button">
              ○
            </button>
            <button className="choice-button" type="button">
              △
            </button>
            <button className="choice-button" type="button">
              ×
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: "yes" | "maybe" | "no";
}) {
  return (
    <article className={`summary-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function AttendanceBadges({
  yes,
  maybe,
  no
}: {
  yes: number;
  maybe: number;
  no: number;
}) {
  return (
    <div className="attendance-badges" aria-label="出欠人数">
      <span>○ {yes}</span>
      <span>△ {maybe}</span>
      <span>× {no}</span>
    </div>
  );
}
