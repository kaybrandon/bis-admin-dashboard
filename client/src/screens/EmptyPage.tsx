export function EmptyPage({ title, message }: { title: string; message?: string }) {
  return (
    <section className="page">
      <h1 className="page-title">{title}</h1>
      <div className="empty-card">
        <p>{message ?? `${title} is empty.`}</p>
      </div>
    </section>
  );
}
